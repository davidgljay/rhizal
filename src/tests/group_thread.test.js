const GroupThread = require('../models/group_thread');
const { graphql } = require('../apis/graphql');
const webSocketManager = require('../apis/signal');
const Script = require('../models/script');
const Membership = require('../models/membership');
const { get } = require('../models/membership');
const fetch = require('node-fetch');

jest.mock('../apis/graphql');
jest.mock('../apis/signal', () => ({
    send: jest.fn(),
    leave_group: jest.fn(),
}));
jest.mock('node-fetch');

jest.mock('../models/membership', () => {
    return {
        create: jest.fn((phone) => ({ 
            id: '1', 
            phone,
            set_variable: jest.fn(),
        })),
        get: jest.fn()
    };
});


const mockScriptSend = jest.fn();
const mockScriptReceive = jest.fn();
const mockGetVars = jest.fn();
const mockScriptMessage = jest.fn();
Script.init = jest.fn().mockImplementation(() => {
    return {
        send: mockScriptSend,
        receive: mockScriptReceive,
        get_vars: mockGetVars,
        script_message: mockScriptMessage,
        vars: {}
    };
});

describe('GroupThread', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('leave_group', () => {
        it('should leave a group', async () => {
            await GroupThread.leave_group('test_group_id', '1234567890');
            expect(webSocketManager.leave_group).toHaveBeenCalledWith('test_group_id', '1234567890');
        });
    });

    describe('find_or_create_group_thread', () => {
        it('should return an existing group thread', async () => {
            const group_id = 'test_group_id';
            const community_id = 'test_community_id';
            const variables = { group_id };
            const mockResponse = {
                data: {
                    group_threads: [
                        {
                            id: '1',
                            group_id: 'test_group_id',
                            community: {
                                id: 'test_community_id',
                                group_threads: [
                                    { group_id: 'test_group_id', hashtag: 'test_hashtag' },
                                ],
                            },
                        },
                    ],
                },
            };
            graphql.mockResolvedValueOnce(mockResponse);

            const result = await GroupThread.find_or_create_group_thread(group_id, community_id);
            expect(result).toEqual(mockResponse.data.group_threads[0]);
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetGroupThread($group_id: String!)'), variables);
        });
    
        it('should create a new group thread if none exists', async () => {
            const group_id = 'new_group_id';
            const community_id = 'new_community_id';
            const getVariables = { group_id };
            const createVariables = { community_id, group_id: "group." + group_id };

            graphql.mockResolvedValueOnce({ data: { group_threads: [] } }); // No existing group thread

            const mockCreateResponse = {
            data: {
                insert_group_threads_one: {
                id: '2',
                group_id: 'new_group_id',
                community: {
                    group_threads: [
                    { group_id: 'new_group_id', hashtag: 'new_hashtag' },
                    ],
                },
                },
            },
            };
            graphql.mockResolvedValueOnce(mockCreateResponse); // Mock creation response

            const result = await GroupThread.find_or_create_group_thread(group_id, community_id);
            expect(result).toEqual(mockCreateResponse.data.insert_group_threads_one);
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining(`query GetGroupThread($group_id: String!)`), getVariables);
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining(`mutation CreateGroupThread($community_id: uuid!, $group_id: String!)`), createVariables);
        });

    });

    describe('set_variable', () => {
        it('should make the expected graphql mutation', async () => {
            const group_id = 'test_group_thread_id';
            const variable = 'test_variable';
            const value = 'test_value';
            const variables = { group_id, value };

            graphql.mockResolvedValueOnce({ data: { update_group_threads: { returning: [{id:'456'}] } } });

            const result = await GroupThread.set_variable(group_id, variable, value);
            expect(result).toEqual({ data: { update_group_threads: { returning: [{id: '456' }] } } });
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)'), variables);
        });

        it('should handle errors gracefully', async () => {
            const group_thread_id = 'test_group_thread_id';
            const variable = 'test_variable';
            const value = 'test_value';

            graphql.mockRejectedValueOnce(new Error('GraphQL error'));

            await expect(GroupThread.set_variable(group_thread_id, variable, value)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalled();
        });
    });

    describe('run_script', () => {
        it('should initialize the script and send step 0 if group_thread step is 0', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '0' };
            const membership = { data: { id: 'membership_id' } };
            const message = undefined;
            const signal_timestamp = 1234567890;

            await GroupThread.run_script(group_thread, membership, message, signal_timestamp);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message, signal_timestamp);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
            expect(mockScriptReceive).not.toHaveBeenCalled();
        });

        it('should initialize the script and call receive if group_thread step is not 0', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '1' };
            const membership = { data: { id: 'membership_id' } };
            const message = 'test message';
            const signal_timestamp = 1234567890;

            await GroupThread.run_script(group_thread, membership, message, signal_timestamp);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message, signal_timestamp);
            expect(mockScriptSend).not.toHaveBeenCalled();
            expect(mockScriptReceive).toHaveBeenCalledWith('1', message);
        });

        it('should send step 3 if the message contains a hashtag and the hashtag is already taken', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '1' };
            const membership = { id: 'membership_id', community: { group_threads: [{ hashtag: '#test_hashtag' }] } };
            const message = '#test_hashtag';
            const signal_timestamp = 1234567890;
            
            await GroupThread.run_script(group_thread, membership, message, signal_timestamp);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message, signal_timestamp);
            expect(mockScriptSend).toHaveBeenCalledWith('3');
            expect(mockScriptReceive).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '0' };
            const membership = { data: { id: 'membership_id' } };
            const message = undefined;
            const signal_timestamp = 1234567890;

            mockScriptSend.mockRejectedValueOnce(new Error('Script error'));

            await expect(GroupThread.run_script(group_thread, membership, message, signal_timestamp)).rejects.toThrow('Script error');
            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message, signal_timestamp);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
        });
    });

    describe('create_group_and_invite', () => {
        it('should create a Signal group and store it in database with admin role', async () => {
            const group_name = 'Test Admin Group';
            const bot_phone = '+1234567890';
            const member_phone = '+0987654321';
            const community = { id: 'community_123', name: 'Test Community' };
            const permissions = ['announcements'];

            const mockSignalResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ id: 'signal_group_id' })
            };
            fetch.mockResolvedValue(mockSignalResponse);

            const mockGraphQLResponse = {
                data: {
                    insert_group_threads_one: {
                        id: 'group_thread_123',
                        group_id: 'signal_group_id'.toString('base64'),
                        step: 'done',
                        permissions: ['announcements'],
                        community: {
                            group_script_id: 'script_123',
                            group_threads: []
                        }
                    }
                }
            };
            graphql.mockResolvedValue(mockGraphQLResponse);

            const result = await GroupThread.create_group_and_invite(group_name, bot_phone, member_phone, permissions, community, true, 'admin');

            expect(fetch).toHaveBeenCalledWith(`http://signal-cli:8080/v1/groups/${bot_phone}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: group_name,
                    members: [member_phone, bot_phone],
                    description: "Members of this group have announcements access to the Rhizal bot for " + community.name,
                    expiration_time: 0,
                    group_link: "disabled",
                    permissions: {
                        add_members: "only-admins",
                        edit_group: "only-admins",
                        send_messages: "every-member"
                    }
                })
            });

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation CreateAdminGroupThread'),
                { community_id: community.id, group_id: "signal_group_id", permissions: permissions, hashtag: '#admin' }
            );

            expect(result).toEqual(mockGraphQLResponse.data.insert_group_threads_one);
        });

        it('should handle Signal API errors gracefully', async () => {
            const group_name = 'Test Admin Group';
            const bot_phone = '+1234567890';
            const member_phone = '+0987654321';
            const community_id = 'community_123';
            const permissions = ['announcements'];

            const mockSignalResponse = {
                ok: false,
                statusText: 'Bad Request'
            };
            fetch.mockResolvedValue(mockSignalResponse);

            await expect(GroupThread.create_group_and_invite(group_name, bot_phone, member_phone, permissions, community_id))
                .rejects.toThrow('Failed to create group: Bad Request');

            expect(fetch).toHaveBeenCalled();
            expect(graphql).not.toHaveBeenCalled();
        });

        it('should handle network errors gracefully', async () => {
            const group_name = 'Test Admin Group';
            const bot_phone = '+1234567890';
            const member_phone = '+0987654321';
            const community_id = 'community_123';
            const permissions = ['announcements'];

            fetch.mockRejectedValue(new Error('Network error'));

            await expect(GroupThread.create_group_and_invite(group_name, bot_phone, member_phone, permissions, community_id))
                .rejects.toThrow('Network error');

            expect(fetch).toHaveBeenCalled();
            expect(graphql).not.toHaveBeenCalled();
        });

        it('should make member admin when make_admin is true', async () => {
            const group_name = 'Test Admin Group';
            const bot_phone = '+1234567890';
            const member_phone = '+0987654321';
            const community = { id: 'community_123', name: 'Test Community' };
            const permissions = ['announcements'];
            const make_admin = true;

            const signal_group_id = Buffer.from('signal_group_id_bytes').toString('base64');
            const mockCreateGroupResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ id: Buffer.from('signal_group_id_bytes') })
            };
            const mockMakeAdminResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({})
            };

            fetch
                .mockResolvedValueOnce(mockCreateGroupResponse)
                .mockResolvedValueOnce(mockMakeAdminResponse);

            const mockGraphQLResponse = {
                data: {
                    insert_group_threads_one: {
                        id: 'group_thread_123',
                        group_id: signal_group_id,
                        step: 'done',
                        permissions: ['announcements'],
                        community: {
                            group_script_id: 'script_123',
                            group_threads: []
                        }
                    }
                }
            };
            graphql.mockResolvedValue(mockGraphQLResponse);

            const result = await GroupThread.create_group_and_invite(
                group_name, 
                bot_phone, 
                member_phone, 
                permissions, 
                community, 
                make_admin,
                'admin'
            );

            // Verify group creation was called
            expect(fetch).toHaveBeenNthCalledWith(1, `http://signal-cli:8080/v1/groups/${bot_phone}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: group_name,
                    members: [member_phone, bot_phone],
                    description: "Members of this group have announcements access to the Rhizal bot for " + community.name,
                    expiration_time: 0,
                    group_link: "disabled",
                    permissions: {
                        add_members: "only-admins",
                        edit_group: "only-admins",
                        send_messages: "every-member"
                    }
                })
            });

            // Verify make_admin endpoint was called
            expect(fetch).toHaveBeenNthCalledWith(2, 
                `http://signal-cli:8080/v1/groups/${bot_phone}/${signal_group_id}/admins`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        admins: [member_phone]
                    })
                }
            );

            // Verify GraphQL mutation was called
            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation CreateAdminGroupThread'),
                { community_id: community.id, group_id: signal_group_id, permissions: permissions, hashtag: '#admin' }
            );

            expect(result).toEqual(mockGraphQLResponse.data.insert_group_threads_one);
        });

        it('should handle make_admin API errors gracefully when make_admin is true', async () => {
            const group_name = 'Test Admin Group';
            const bot_phone = '+1234567890';
            const member_phone = '+0987654321';
            const community = { id: 'community_123', name: 'Test Community' };
            const permissions = ['announcements'];
            const make_admin = true;

            const signal_group_id = Buffer.from('signal_group_id_bytes').toString('base64');
            const mockCreateGroupResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ id: Buffer.from('signal_group_id_bytes') })
            };
            const mockMakeAdminResponse = {
                ok: false,
                statusText: 'Forbidden'
            };

            fetch
                .mockResolvedValueOnce(mockCreateGroupResponse)
                .mockResolvedValueOnce(mockMakeAdminResponse);

            await expect(GroupThread.create_group_and_invite(
                group_name, 
                bot_phone, 
                member_phone, 
                permissions, 
                community, 
                make_admin
            )).rejects.toThrow('Failed to make admin: Forbidden');

            // Verify group creation was called
            expect(fetch).toHaveBeenCalledTimes(2);
            // Verify make_admin endpoint was called
            expect(fetch).toHaveBeenNthCalledWith(2, 
                `http://signal-cli:8080/v1/groups/${bot_phone}/${signal_group_id}/admins`,
                expect.any(Object)
            );
            // Verify GraphQL mutation was not called due to error
            expect(graphql).not.toHaveBeenCalled();
        });
    });

});