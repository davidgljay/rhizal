const { graphql } = require('../apis/graphql');
const Message = require('../models/message');

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
                sent_time: '2023-10-01T00:00:00Z',
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
                sent_time: '2023-10-01T00:00:00Z'
            }
            graphql.mockResolvedValue({ data: { insert_messages_one: mockMessage } });
            const result = await Message.create('community_1', 'membership_1', 'Hello, world!', '2023-10-01T00:00:00Z', true);

            expect(graphql).toHaveBeenCalledWith( expect.stringContaining('mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)'), messageVars );
            expect(result).toEqual(mockMessage);
        });

        it('should throw an error if creating the message fails', async () => {
            const errorMessage = 'Error creating message';
            graphql.mockRejectedValue(new Error(errorMessage));

            await expect(Message.create('user1', 'Hello, world!', '2023-10-01T00:00:00Z', ['user2', 'user3'])).rejects.toThrow(errorMessage);
        });
    });
});