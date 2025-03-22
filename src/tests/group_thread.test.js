const GroupThreads = require('../models/group_thread');
const { graphql } = require('../apis/graphql');

jest.mock('../apis/graphql');

describe('GroupThreads', () => {
    describe('get_hashtag_group', () => {
        it('should return an empty array if no group threads are found', async () => {
            graphql.mockResolvedValueOnce({ data: { group_threads: [] } });

            const result = await GroupThreads.get_hashtag_group('test_signal_id', 'test_hashtag');
            expect(result).toEqual([]);
        });

        it('should return filtered hashtags matching the provided hashtag', async () => {
            const mockResponse = {
                data: {
                    group_threads: [
                        {
                            community: {
                                group_threads: [
                                    { signal_id: '1', hashtag: 'test_hashtag' },
                                    { signal_id: '2', hashtag: 'other_hashtag' },
                                ],
                            },
                        },
                    ],
                },
            };
            graphql.mockResolvedValueOnce(mockResponse);

            const result = await GroupThreads.get_hashtag_group('test_signal_id', 'test_hashtag');
            expect(result).toEqual([{ signal_id: '1', hashtag: 'test_hashtag' }]);
        });
    });

    describe('send_message', () => {
        let webSocketManager;

        beforeEach(() => {
            webSocketManager = {
                send: jest.fn(),
            };
            global.webSocketManager = webSocketManager;
        });

        it('should send a message', async () => {
            await GroupThreads.send_message('Hello', '1234567890', 'test_signal_id');

            expect(webSocketManager.send).toHaveBeenCalledWith(
                ['test_signal_id'],
                '1234567890',
                'Hello'
            );
        });
    });
});