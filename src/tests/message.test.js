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
                sender: 'user1',
                sent_time: '2023-10-01T00:00:00Z',
                recipients: ['user2', 'user3']
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
                sender: 'user1',
                sent_time: '2023-10-01T00:00:00Z',
                recipients: ['user2', 'user3']
            };
            const mockMessageWithoutId = mockMessage;
            delete mockMessageWithoutId.id;
            graphql.mockResolvedValue({ data: { createMessage: mockMessage } });

            const result = await Message.create('user1', ['user2', 'user3'], 'Hello, world!', '2023-10-01T00:00:00Z');

            expect(graphql).toHaveBeenCalledWith( expect.stringContaining('mutation CreateMessage($text:String!, $sender:String!, $sent_time:timestamptz!, $recipients:[String!]!)'), mockMessageWithoutId );
            expect(result).toEqual(mockMessage);
        });

        it('should throw an error if creating the message fails', async () => {
            const errorMessage = 'Error creating message';
            graphql.mockRejectedValue(new Error(errorMessage));

            await expect(Message.create('user1', 'Hello, world!', '2023-10-01T00:00:00Z', ['user2', 'user3'])).rejects.toThrow(errorMessage);
        });
    });
});