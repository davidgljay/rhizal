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
                sent_time: '2023-10-01T00:00:00.000Z',
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
                sent_time: '2023-10-01T00:00:00.000Z'
            }
            graphql.mockResolvedValue({ data: { insert_messages_one: mockMessage } });
            const ms_time = new Date('2023-10-01T00:00:00Z').getTime();
            const result = await Message.create('community_1', 'membership_1', 'Hello, world!', ms_time, true);

            expect(graphql).toHaveBeenCalledWith( expect.stringContaining('mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)'), messageVars );
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
            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => {});

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', true);

            expect(mockCreate).toHaveBeenCalledWith('community_1', 'membership_1', 'Hello, world!', expect.any(Number), false);
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            mockCreate.mockRestore();
            mockSend.mockRestore();
        });

        it('should send a message via WebSocket without logging it', async () => {
            const mockCreate = jest.spyOn(Message, 'create');
            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => {});

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', false);

            expect(mockCreate).not.toHaveBeenCalled();
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            mockCreate.mockRestore();
            mockSend.mockRestore();
        });

        it('should delay sending the message in non-test environments', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => {});
            const mockDelay = jest.spyOn(global, 'setTimeout');

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', false);

            expect(mockDelay).toHaveBeenCalledWith(expect.any(Function), 2000);
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            process.env.NODE_ENV = originalEnv;
            mockSend.mockRestore();
            mockDelay.mockRestore();
        });

        it('should not delay sending the message in test environments', async () => {
            const mockSend = jest.spyOn(Signal, 'send').mockImplementation(() => {});
            const mockDelay = jest.spyOn(global, 'setTimeout');

            await Message.send('community_1', 'membership_1', 'to_phone', 'from_phone', 'Hello, world!', false);

            expect(mockDelay).not.toHaveBeenCalled();
            expect(mockSend).toHaveBeenCalledWith(['to_phone'], 'from_phone', 'Hello, world!');

            mockSend.mockRestore();
            mockDelay.mockRestore();
        });
    });
});