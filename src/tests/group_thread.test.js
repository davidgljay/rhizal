const GroupThreads = require('../models/group_thread');
const { graphql } = require('../apis/graphql');
const webSocketManager = require('../apis/signal');
const Script = require('../models/script');
const Membership = require('../models/membership');
const { get } = require('../models/membership');

jest.mock('../apis/graphql');
jest.mock('../apis/signal', () => ({
    send: jest.fn(),
    leave_group: jest.fn(),
}));

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
        script_message: mockScriptMessage
    };
});

describe('GroupThreads', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('get_hashtag_group', () => {
        it('should make the expected graphql query', async () => {
            const group_id = 'test_group_id';
            const hashtags = ['test_hashtag'];
            const query = `
query getGroupThreads($group_id: String!) {
    group_threads(where: {group_id: {_eq: $group_id}}) {
        community {
            group_threads {
                group_id
                hashtag
            }
        }
    }
}`;
            graphql.mockResolvedValueOnce({ data: { group_threads: [] } });
            const variables = { group_id };
            await GroupThreads.get_hashtag_group(group_id, hashtags);
            expect(graphql).toHaveBeenCalledWith(query, variables);
        });

        it('should return an empty array if no group threads are found', async () => {
            graphql.mockResolvedValueOnce({ data: { group_threads: [] } });

            const result = await GroupThreads.get_hashtag_group('test_group_id', ['test_hashtag']);
            expect(result).toEqual([]);
        });

        it('should return filtered hashtags matching the provided hashtag', async () => {
            const mockResponse = {
                data: {
                    group_threads: [
                        {
                            community: {
                                group_threads: [
                                    { group_id: '1', hashtag: 'test_hashtag' },
                                    { group_id: '2', hashtag: 'other_hashtag' },
                                ],
                            },
                        },
                    ],
                },
            };
            graphql.mockResolvedValueOnce(mockResponse);

            const result = await GroupThreads.get_hashtag_group('test_group_id', ['test_hashtag']);
            expect(result).toEqual([{ group_id: '1', hashtag: 'test_hashtag' }]);
        });

        it('should return multiple filtered hashtags matching the multiple provided hashtags', async () => {
            const mockResponse = {
                data: {
                    group_threads: [
                        {
                            community: {
                                group_threads: [
                                    { group_id: '1', hashtag: 'test_hashtag' },
                                    { group_id: '2', hashtag: 'other_hashtag' },
                                ],
                            },
                        },
                    ],
                },
            };
            graphql.mockResolvedValueOnce(mockResponse);

            const result = await GroupThreads.get_hashtag_group('test_group_id', ['test_hashtag','other_hashtag']);
            expect(result).toEqual([
                { group_id: '1', hashtag: 'test_hashtag' },
                { group_id: '2', hashtag: 'other_hashtag' },
            ]);
        });
    });

    describe('send_message', () => {

        it('should send a message', async () => {
            await GroupThreads.send_message('Hello', '1234567890', 'test_group_id');

            expect(webSocketManager.send).toHaveBeenCalledWith(
                ['test_group_id'],
                '1234567890',
                'Hello'
            );
        });
    });

    describe('recieve_group_message', () => {
        beforeEach(() => {
            jest.spyOn(GroupThreads, 'send_message').mockResolvedValue();
            jest.spyOn(GroupThreads, 'group_thread_script').mockResolvedValue();
        });

        it('should handle messages when group_thread step is not "done"', async () => {
            const group_id = 'test_group_id';
            const message = 'test message';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';

            const mockMembership = { data: { community: { id: 'community_id' } } };
            const mockGroupThread = { step: '0' };

            jest.spyOn(GroupThreads, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            jest.spyOn(Membership, 'get').mockResolvedValue(mockMembership);

            await GroupThreads.recieve_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(Membership.get).toHaveBeenCalledWith(from_phone, bot_phone);
            expect(GroupThreads.find_or_create_group_thread).toHaveBeenCalledWith(group_id, 'community_id');
            expect(GroupThreads.group_thread_script).toHaveBeenCalledWith(mockGroupThread, mockMembership, message);
        });

        it('should return if there is no message and the group step is done', async () => {
            const group_id = 'test_group_id';
            const message = null;
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done' };

            jest.spyOn(GroupThreads, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);

            await GroupThreads.recieve_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(Membership.get).toHaveBeenCalled();
            expect(GroupThreads.find_or_create_group_thread).toHaveBeenCalled();
            expect(GroupThreads.group_thread_script).not.toHaveBeenCalled();
            expect(GroupThreads.send_message).not.toHaveBeenCalled();
        });

        it('should return if there are no hashtags in the message', async () => {
            const group_id = 'test_group_id';
            const message = 'No hashtags here';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done' };

            jest.spyOn(GroupThreads, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);

            await GroupThreads.recieve_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(Membership.get).toHaveBeenCalled();
            expect(GroupThreads.find_or_create_group_thread).toHaveBeenCalled();
            expect(GroupThreads.group_thread_script).not.toHaveBeenCalled();
            expect(GroupThreads.send_message).not.toHaveBeenCalled();
        });

        it('should leave the group if the message contains the "leave" hashtag', async () => {
            const group_id = 'test_group_id';
            const message = '#leave';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done', community: {group_threads: [{group_id: '123', hashtag: '#test'}]} };

            jest.spyOn(GroupThreads, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            jest.spyOn(GroupThreads, 'leave_group').mockResolvedValue();
            

            await GroupThreads.recieve_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(GroupThreads.leave_group).toHaveBeenCalledWith(group_id, bot_phone);
            expect(Membership.get).toHaveBeenCalled();
            expect(GroupThreads.find_or_create_group_thread).toHaveBeenCalled();
            expect(GroupThreads.group_thread_script).not.toHaveBeenCalled();
            expect(GroupThreads.send_message).not.toHaveBeenCalled();
        });

        it('should relay messages to groups with matching hashtags', async () => {
            const group_id = 'test_group_id';
            const message = '#test_hashtag Message content';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';

            const mockMembership = { data: { community: { id: 'community_id' } } };
            const mockGroupThread = {
                step: 'done',
                community: {
                    group_threads: [
                        { group_id: '1', hashtag: '#test_hashtag' },
                        { group_id: '2', hashtag: '#other_hashtag' },
                    ],
                },
                hashtag: '#other_hashtag',
            };

            jest.spyOn(GroupThreads, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            jest.spyOn(Membership, 'get').mockResolvedValue(mockMembership);
            jest.spyOn(GroupThreads, 'send_message').mockResolvedValue();

            await GroupThreads.recieve_group_message(group_id, message, from_phone, bot_phone, sender_name);

            const expectedMessage = `Message relayed from ${from_phone}(${sender_name}) in #${mockGroupThread.hashtag}: ${message}`;
            expect(GroupThreads.send_message).toHaveBeenCalledWith(expectedMessage, bot_phone, '1');
            expect(GroupThreads.send_message).not.toHaveBeenCalledWith(expectedMessage, bot_phone, '2');
        });
    });

    describe('leave_group', () => {
        it('should leave a group', async () => {
            console.log('testing leave group');
            await GroupThreads.leave_group('test_group_id', '1234567890');
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

            const result = await GroupThreads.find_or_create_group_thread(group_id, community_id);
            expect(result).toEqual(mockResponse.data.group_threads[0]);
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetGroupThread($group_id: String!)'), variables);
        });
    
        it('should create a new group thread if none exists', async () => {
            const group_id = 'new_group_id';
            const community_id = 'new_community_id';
            const getVariables = { group_id };
            const createVariables = { community_id, group_id };

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

            const result = await GroupThreads.find_or_create_group_thread(group_id, community_id);
            expect(result).toEqual(mockCreateResponse.data.insert_group_threads_one);
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining(`query GetGroupThread($group_id: String!)`), getVariables);
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining(`mutation CreateGroupThread($community_id: uuid!, $group_id: String!)`), createVariables);
        });

    });

    describe('update_group_thread_variable', () => {
        it('should make the expected graphql mutation', async () => {
            const group_thread_id = 'test_group_thread_id';
            const variable = 'test_variable';
            const value = 'test_value';
            const variables = { group_thread_id, variable, value };

            graphql.mockResolvedValueOnce({ data: { update_group_threads_by_pk: { id: group_thread_id } } });

            const result = await GroupThreads.update_group_thread_variable(group_thread_id, variable, value);
            expect(result).toEqual({ data: { update_group_threads_by_pk: { id: group_thread_id } } });
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('mutation UpdateGroupThreadVariable($group_thread_id: uuid!, $variable: String!, $value: String!)'), variables);
        });

        it('should handle errors gracefully', async () => {
            const group_thread_id = 'test_group_thread_id';
            const variable = 'test_variable';
            const value = 'test_value';

            graphql.mockRejectedValueOnce(new Error('GraphQL error'));

            await expect(GroupThreads.update_group_thread_variable(group_thread_id, variable, value)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalled();
        });
    });

    describe('group_thread_script', () => {
        it('should initialize the script and send step 0 if group_thread step is 0', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '0' };
            const membership = { data: { id: 'membership_id' } };
            const message = 'test message';

            await GroupThreads.group_thread_script(group_thread, membership, message);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
            expect(mockScriptReceive).not.toHaveBeenCalled();
        });

        it('should initialize the script and call receive if group_thread step is not 0', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '1' };
            const membership = { data: { id: 'membership_id' } };
            const message = 'test message';

            await GroupThreads.group_thread_script(group_thread, membership, message);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message);
            expect(mockScriptSend).not.toHaveBeenCalled();
            expect(mockScriptReceive).toHaveBeenCalledWith('1', message);
        });

        it('should handle errors gracefully', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '0' };
            const membership = { data: { id: 'membership_id' } };
            const message = 'test message';

            mockScriptSend.mockRejectedValueOnce(new Error('Script error'));

            await expect(GroupThreads.group_thread_script(group_thread, membership, message)).rejects.toThrow('Script error');
            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
        });
    });
});