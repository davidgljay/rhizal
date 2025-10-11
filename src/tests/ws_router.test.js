const { receive_raw_message } = require('../routes/ws');
jest.mock('../handlers/receive_message');
const { group_join_or_leave } = require('../handlers/receive_message');

describe('WebSocket Router', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('receive_raw_message', () => {
        it('should handle group member join events and call handle_member_join_or_leave to add a member', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 0,
                            type: 'UPDATE',
                            members: ['+1234567890']
                        }
                    }
                },
                account: '+0987654321'
            };

            group_join_or_leave.mockResolvedValue();

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).toHaveBeenCalledWith(
                Buffer.from('test_group_id').toString('base64'),
                '+1234567890',
                '+0987654321',
                true
            );
        });

        it('should handle group member leave events and call handle_member_join_or_leave', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 0,
                            type: 'UPDATE',
                            members: ['+3210987654']
                        }
                    }
                },
                account: '+0987654321'
            };

            group_join_or_leave.mockResolvedValue();

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).toHaveBeenCalledWith(
                Buffer.from('test_group_id').toString('base64'),
                '+1234567890',
                '+0987654321',
                false
            );
        });

        it('should not call handle_member_join_or_leave for non-join group events', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 1,
                            type: 'UPDATE'
                        }
                    }
                },
                account: '+0987654321'
            };

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should not call handle_member_join_or_leave for non-UPDATE group events', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 0,
                            type: 'CREATE'
                        }
                    }
                },
                account: '+0987654321'
            };

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should ignore kick events (revision 21)', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 21
                        }
                    }
                },
                account: '+0987654321'
            };

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should handle regular group messages normally', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        message: 'Hello group!',
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 1
                        }
                    }
                },
                account: '+0987654321'
            };

            // Mock the receive_group_message function
            const mockReceiveGroupMessage = jest.fn();
            jest.doMock('../handlers/receive_message', () => ({
                receive_group_message: mockReceiveGroupMessage
            }));

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should handle individual messages normally', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        message: 'Hello!'
                    }
                },
                account: '+0987654321'
            };

            // Mock the receive_message function
            const mockReceiveMessage = jest.fn();
            jest.doMock('../handlers/receive_message', () => ({
                receive_message: mockReceiveMessage
            }));

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should handle reply messages normally', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        message: 'Reply message',
                        quote: {
                            author: '+0987654321',
                            id: 1234567890
                        }
                    }
                },
                account: '+0987654321'
            };

            // Mock the receive_reply function
            const mockReceiveReply = jest.fn();
            jest.doMock('../handlers/receive_message', () => ({
                receive_reply: mockReceiveReply
            }));

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should return early if message is invalid', async () => {
            const invalidMessage = null;

            await receive_raw_message(invalidMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should return early if envelope is missing', async () => {
            const mockMessage = {
                account: '+0987654321'
            };

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should return early if dataMessage is missing', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User'
                },
                account: '+0987654321'
            };

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it ('shuold not call handle_member_join_or_leave if groupInfo.members is missing for some reason', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 0,
                            type: 'UPDATE'
                        }
                    }
        
                },
                account: '+0987654321'
            };

            await receive_raw_message(mockMessage);

            expect(group_join_or_leave).not.toHaveBeenCalled();
        });

        it('should handle errors in handle_member_join_or_leave gracefully', async () => {
            const mockMessage = {
                envelope: {
                    sourceUuid: '+1234567890',
                    timestamp: 1234567890,
                    sourceName: 'Test User',
                    dataMessage: {
                        groupInfo: {
                            groupId: 'test_group_id',
                            revision: 0,
                            type: 'UPDATE',
                            members: ['+1234567890']
                        }
                    }
                },
                account: '+0987654321'
            };

            group_join_or_leave.mockRejectedValue(new Error('Database error'));

            // Should not throw
            await expect(receive_raw_message(mockMessage)).resolves.toBeUndefined();

            expect(group_join_or_leave).toHaveBeenCalledWith(
                Buffer.from('test_group_id').toString('base64'),
                '+1234567890',
                '+0987654321',
                true
            );
        });
    });
});