const GroupThread = require('../models/group_thread');
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
        script_message: mockScriptMessage,
        vars: {}
    };
});

describe('GroupThread', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('send_message', () => {

        it('should send a message', async () => {
            await GroupThread.send_message('Hello', '1234567890', 'test_group_id');

            expect(webSocketManager.send).toHaveBeenCalledWith(
                ['test_group_id'],
                '1234567890',
                'Hello'
            );
        });
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

            await GroupThread.run_script(group_thread, membership, message);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
            expect(mockScriptReceive).not.toHaveBeenCalled();
        });

        it('should initialize the script and call receive if group_thread step is not 0', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '1' };
            const membership = { data: { id: 'membership_id' } };
            const message = 'test message';

            await GroupThread.run_script(group_thread, membership, message);

            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message);
            expect(mockScriptSend).not.toHaveBeenCalled();
            expect(mockScriptReceive).toHaveBeenCalledWith('1', message);
        });

        it('should handle errors gracefully', async () => {
            const group_thread = { community: { group_script_id: 'script_id' }, step: '0' };
            const membership = { data: { id: 'membership_id' } };
            const message = undefined;

            mockScriptSend.mockRejectedValueOnce(new Error('Script error'));

            await expect(GroupThread.run_script(group_thread, membership, message)).rejects.toThrow('Script error');
            expect(Script.init).toHaveBeenCalledWith('script_id');
            expect(mockGetVars).toHaveBeenCalledWith(membership, message);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
        });
    });
});