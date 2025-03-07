const { graphql } = require('../apis/graphql');
const Message = require('../models/message');

jest.mock('../apis/graphql');

describe('Message', () => {
    let message;

    beforeEach(() => {
        message = new Message();
    });

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

            const result = await message.get('1');

            expect(graphql).toHaveBeenCalledWith(expect.any(String), { id: '1' });
            expect(result).toEqual(mockMessage);
            expect(message.id).toBe(mockMessage.id);
            expect(message.text).toBe(mockMessage.text);
            expect(message.sender).toBe(mockMessage.sender);
            expect(message.sent_time).toBe(mockMessage.sent_time);
            expect(message.recipients).toEqual(mockMessage.recipients);
        });

        it('should throw an error if fetching the message fails', async () => {
            const errorMessage = 'Error fetching message';
            graphql.mockRejectedValue(new Error(errorMessage));

            await expect(message.get('1')).rejects.toThrow(errorMessage);
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

            const result = await message.create('user1', 'Hello, world!', '2023-10-01T00:00:00Z', ['user2', 'user3']);

            expect(graphql).toHaveBeenCalledWith(expect.any(String), { input: mockMessageWithoutId });
            expect(result).toEqual(mockMessage);
            expect(message.id).toBe(mockMessage.id);
            expect(message.text).toBe(mockMessage.text);
            expect(message.sender).toBe(mockMessage.sender);
            expect(message.sent_time).toBe(mockMessage.sent_time);
            expect(message.recipients).toEqual(mockMessage.recipients);
        });

        it('should throw an error if creating the message fails', async () => {
            const errorMessage = 'Error creating message';
            graphql.mockRejectedValue(new Error(errorMessage));

            await expect(message.create('user1', 'Hello, world!', '2023-10-01T00:00:00Z', ['user2', 'user3'])).rejects.toThrow(errorMessage);
        });
    });
});