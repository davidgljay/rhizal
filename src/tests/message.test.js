const { graphql } = require('../apis/graphql');
const Message = require('../models/message');
const Signal = require('../apis/signal');

jest.mock('../apis/signal');
jest.mock('../apis/graphql');

describe('Message', () => {
    let message;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should fetch a message by id', async () => {
            const mockMessage = {
                id: '1',
                text: 'Hello, world!',
                from_user: true,
                membership: {
                    id: '2',
                    user: {
                        phone: 'user1'
                    }
                },
                community: {
                    id: '3',
                    bot_phone: 'bot_phone'
                },
                sent_time: '2023-10-01T00:00:00Z'
            };
            graphql.mockResolvedValue({ data: { message: mockMessage } });

            const result = await Message.get('1');

            expect(graphql).toHaveBeenCalledWith(expect.any(String), { id: '1' });
            expect(result).toEqual(mockMessage);
        });

        it('should throw an error if fetching the message fails', async () => {
            const errorMessage = 'Error fetching message';
            graphql.mockRejectedValue(new Error(errorMessage));

            await expect(Message.get('1')).rejects.toThrow(errorMessage);
        });
    });

    describe('create', () => {
        it('should create a new message', async () => {
            const mockMessage = {
                id: '1',
                text: 'Hello, world!',
                signal_timestamp: 1234567890,
                from_user: true,
                membership: {
                    id: '2',
                    user: {
                        phone: 'user1'
                    }
                },
                community: {
                    id: '3',
                    bot_phone: 'bot_phone'
                }
            };
            const messageVars = {
                community_id: 'community_1',
                from_user: true,
                membership_id: 'membership_1',
                text: 'Hello, world!',
                signal_timestamp: 1696118400000,
                about_membership_id: null,
                message_type: 'message'
            }
            graphql.mockResolvedValue({ data: { insert_messages_one: mockMessage } });
            const ms_time = new Date('2023-10-01T00:00:00Z').getTime();
            const result = await Message.create('community_1', 'membership_1', 'Hello, world!', ms_time, true);

            expect(graphql).toHaveBeenCalledWith( expect.stringContaining('mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $signal_timestamp: bigint!, $about_membership_id: uuid = null, $message_type: String = "message")'), messageVars );
            expect(result).toEqual(mockMessage);
        });

        it('should throw an error if creating the message fails', async () => {
            const errorMessage = 'Error creating message';
            graphql.mockRejectedValue(new Error(errorMessage));
            const ms_time = new Date('2023-10-01T00:00:00Z').getTime();
            await expect(Message.create('community_1', 'membership_1', 'Hello, world!', ms_time, ['user2', 'user3'])).rejects.toThrow(errorMessage);
        });
    });

    describe('send', () => {
        it('should send a message via WebSocket and log it', async () => {
            const mockCreate = jest.spyOn(Message, 'create').mockResolvedValue({});
            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => ({timestamp: 1234567890}));

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', true);

            expect(mockCreate).toHaveBeenCalledWith('community_1', 'membership_1', '', 1234567890, false, null, 'message');
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            mockCreate.mockRestore();
            mockSend.mockRestore();
        });

        it('should send a message via WebSocket without logging it', async () => {
            const mockCreate = jest.spyOn(Message, 'create');
            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => ({timestamp: 1234567890}));

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', false);

            expect(mockCreate).not.toHaveBeenCalled();
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            mockCreate.mockRestore();
            mockSend.mockRestore();
        });

        it('should delay sending the message in non-test environments', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => ({timestamp: 1234567890}));
            const mockDelay = jest.spyOn(global, 'setTimeout');

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', false);

            expect(mockDelay).toHaveBeenCalledWith(expect.any(Function), 1000);
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            process.env.NODE_ENV = originalEnv;
            mockSend.mockRestore();
            mockDelay.mockRestore();
        });

        it('should not delay sending the message in test environments', async () => {
            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => ({timestamp: 1234567890}));
            const mockDelay = jest.spyOn(global, 'setTimeout');

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', false);

            expect(mockDelay).not.toHaveBeenCalled();
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            mockSend.mockRestore();
            mockDelay.mockRestore();
        });
    });

    describe('send_announcement', () => {
        it('should send an announcement to all members of a community', async () => {
            const mockCommunity = {
                id: 'community_1',
                bot_phone: 'bot_phone',
                memberships: [
                    { id: 'membership_1', user: { phone: 'user1' } },
                    { id: 'membership_2', user: { phone: 'user2' } }
                ],
                messages: [
                    { id: 'message_1', text: 'draft announcement' }
                ]
            };
            const mockSend = jest.spyOn(Message, 'send').mockResolvedValue({});

            graphql.mockResolvedValue({ data: { communities: [mockCommunity] } });

            await Message.send_announcement('community_1', 'membership_1');

            expect(graphql).toHaveBeenCalledWith(expect.any(String), { community_id: 'community_1', membership_id: 'membership_1' });
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenNthCalledWith(1, 'community_1', 'membership_1', 'user1', 'bot_phone', 'draft announcement', true, null, "announcement", 500);
            expect(mockSend).toHaveBeenNthCalledWith(2, 'community_1', 'membership_2', 'user2', 'bot_phone', 'draft announcement', true, null, "announcement", 500);

            mockSend.mockRestore();
        });

        it('should not send an announcement if no draft announcement is found', async () => {
            const mockCommunity = {
                id: 'community_1',
                bot_phone: 'bot_phone',
                memberships: [
                    { id: 'membership_1', user: { phone: 'user1' } }
                ],
                messages: []
            };

            graphql.mockResolvedValue({ data: { communities: [mockCommunity] } });

            await Message.send_announcement('community_1', 'membership_1');

            expect(graphql).toHaveBeenCalledWith(expect.any(String), { community_id: 'community_1', membership_id: 'membership_1' });
            expect(Signal.send).not.toHaveBeenCalled();
        });

        it('should not send an announcement if the community is not found', async () => {
            graphql.mockResolvedValue({ data: { communities: [] } });

            await Message.send_announcement('community_1', 'membership_1');

            expect(graphql).toHaveBeenCalledWith(expect.any(String), { community_id: 'community_1', membership_id: 'membership_1' });
            expect(Signal.send).not.toHaveBeenCalled();
        });

        it('should handle errors when sending an announcement', async () => {
            const errorMessage = 'Error sending announcement';
            graphql.mockRejectedValue(new Error(errorMessage));

            await expect(Message.send_announcement('community_1', 'membership_1')).rejects.toThrow(errorMessage);
        });
    });


    describe('send_to_onboarding', () => {

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should send a message to onboarding groups if they exist', async () => {
            const mockSend = jest.spyOn(Message, 'send').mockResolvedValue({});
            const mockCommunity = {
                id: 'community_1',
                bot_phone: 'bot_phone',
                onboarding_groups: [
                    { id: 'onboarding_group_1', group_id: 'onboarding_group_id_1' },
                    { id: 'onboarding_group_2', group_id: 'onboarding_group_id_2' }
                ]
            };
            graphql.mockResolvedValue({ data: { communities: [mockCommunity] } });

            await Message.send_to_onboarding('community_1', 'sender_id', 'Hello, onboarding!');

            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenNthCalledWith(1,
                'community_1',
                'sender_id', // No specific membership_id for group messages
                'group.onboarding_group_id_1',
                'bot_phone',
                'Hello, onboarding!',
                true, 
                'sender_id',
                `relay_to_onboarding_group`,
                0
            );
            expect(mockSend).toHaveBeenNthCalledWith(2,
                'community_1',
                'sender_id', // No specific membership_id for group messages
                'group.onboarding_group_id_2',
                'bot_phone',
                'Hello, onboarding!',
                true, 
                'sender_id',
                `relay_to_onboarding_group`,
                0
            );

            mockSend.mockRestore();
        });


        it('should handle errors when fetching community data', async () => {
            graphql.mockResolvedValue({ data: { communities: [] } });
            await expect(Message.send_to_onboarding('community_1', 'sender_id', 'Hello, onboarding!')).rejects.toThrow('Community not found');
        });
    });
});