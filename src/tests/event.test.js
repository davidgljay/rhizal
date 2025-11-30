const Event = require('../models/event');
const { graphql } = require('../apis/graphql');

jest.mock('../apis/graphql');

describe('Event', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create an event with required parameters', async () => {
            const community_id = 'community-123';
            const creator_id = 'creator-456';
            const title = 'Test Event';

            const mockResponse = {
                data: {
                    insert_events_one: {
                        id: 'event-789',
                        title: 'Test Event',
                        community_id: 'community-123',
                        creator_id: 'creator-456'
                    }
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            const result = await Event.create(community_id, creator_id, title);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation CreateEvent'),
                { community_id, creator_id, title }
            );
            expect(result).toBeInstanceOf(Event);
            expect(result.id).toBe('event-789');
            expect(result.title).toBe('Test Event');
        });

        it('should handle GraphQL errors gracefully', async () => {
            const community_id = 'community-123';
            const creator_id = 'creator-456';
            const title = 'Test Event';

            graphql.mockRejectedValueOnce(new Error('GraphQL error'));

            await expect(Event.create(community_id, creator_id, title)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalled();
        });
    });

    describe('set_variable', () => {
        it('should set a valid event variable', async () => {
            const event_id = 'event-123';
            const variable = 'title';
            const value = 'Updated Title';

            const mockResponse = {
                data: {
                    update_events: {
                        returning: [{ id: 'event-123', title: 'Updated Title' }]
                    }
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            const result = await Event.set_variable(event_id, variable, value);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation UpdateEventVariable'),
                { event_id, value }
            );
            expect(result).toEqual(mockResponse);
        });

        it('should set description variable', async () => {
            const event_id = 'event-123';
            const variable = 'description';
            const value = 'Updated description';

            const mockResponse = {
                data: {
                    update_events: {
                        returning: [{ id: 'event-123', description: 'Updated description' }]
                    }
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            await Event.set_variable(event_id, variable, value);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation UpdateEventVariable'),
                { event_id, value }
            );
        });

        it('should set start_time variable', async () => {
            const event_id = 'event-123';
            const variable = 'start_time';
            const value = '2024-12-25T14:00:00Z';

            const mockResponse = {
                data: {
                    update_events: {
                        returning: [{ id: 'event-123', start_time: '2024-12-25T14:00:00Z' }]
                    }
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            await Event.set_variable(event_id, variable, value);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation UpdateEventVariable'),
                { event_id, value }
            );
        });

        it('should set end_time variable', async () => {
            const event_id = 'event-123';
            const variable = 'end_time';
            const value = '2024-12-25T18:00:00Z';

            const mockResponse = {
                data: {
                    update_events: {
                        returning: [{ id: 'event-123', end_time: '2024-12-25T18:00:00Z' }]
                    }
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            await Event.set_variable(event_id, variable, value);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation UpdateEventVariable'),
                { event_id, value }
            );
        });

        it('should set location variable', async () => {
            const event_id = 'event-123';
            const variable = 'location';
            const value = '123 Main St';

            const mockResponse = {
                data: {
                    update_events: {
                        returning: [{ id: 'event-123', location: '123 Main St' }]
                    }
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            await Event.set_variable(event_id, variable, value);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('mutation UpdateEventVariable'),
                { event_id, value }
            );
        });

        it('should skip setting step variable (not in schema)', async () => {
            const event_id = 'event-123';
            const variable = 'step';
            const value = '1';

            await Event.set_variable(event_id, variable, value);

            expect(graphql).not.toHaveBeenCalled();
        });

        it('should throw an error for invalid variable', async () => {
            const event_id = 'event-123';
            const variable = 'invalid_variable';
            const value = 'some value';

            await expect(Event.set_variable(event_id, variable, value)).rejects.toThrow(
                'Invalid variable. Valid variables are: title, description, start_time, end_time, location, step'
            );
            expect(graphql).not.toHaveBeenCalled();
        });

        it('should handle GraphQL errors gracefully', async () => {
            const event_id = 'event-123';
            const variable = 'title';
            const value = 'Updated Title';

            graphql.mockRejectedValueOnce(new Error('GraphQL error'));

            await expect(Event.set_variable(event_id, variable, value)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalled();
        });
    });

    describe('get_by_creator', () => {
        it('should get the most recent event by creator', async () => {
            const creator_id = 'creator-123';

            const mockResponse = {
                data: {
                    events: [
                        {
                            id: 'event-456',
                            title: 'Most Recent Event',
                            description: 'Description',
                            start_time: '2024-12-25T14:00:00Z',
                            end_time: null,
                            location: null,
                            created_at: '2024-12-20T10:00:00Z',
                            community_id: 'community-123',
                            creator_id: 'creator-123'
                        }
                    ]
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            const result = await Event.get_by_creator(creator_id);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('query GetEvents'),
                { creator_id }
            );
            expect(result).toBeInstanceOf(Event);
            expect(result.id).toBe('event-456');
            expect(result.title).toBe('Most Recent Event');
        });

        it('should return undefined if no events found', async () => {
            const creator_id = 'creator-123';

            const mockResponse = {
                data: {
                    events: []
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            const result = await Event.get_by_creator(creator_id);

            expect(graphql).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should handle GraphQL errors gracefully', async () => {
            const creator_id = 'creator-123';

            graphql.mockRejectedValueOnce(new Error('GraphQL error'));

            await expect(Event.get_by_creator(creator_id)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalled();
        });
    });

    describe('get', () => {
        it('should get an event by id', async () => {
            const event_id = 'event-123';

            const mockResponse = {
                data: {
                    events: [
                        {
                            id: 'event-123',
                            title: 'Test Event',
                            description: 'Test Description',
                            start_time: '2024-12-25T14:00:00Z',
                            end_time: '2024-12-25T18:00:00Z',
                            location: '123 Main St',
                            created_at: '2024-12-20T10:00:00Z',
                            community_id: 'community-123',
                            creator_id: 'creator-456',
                            community: {
                                id: 'community-123',
                                bot_phone: '+1234567890'
                            },
                            creator: {
                                id: 'creator-456',
                                user: {
                                    phone: '+0987654321'
                                }
                            }
                        }
                    ]
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            const result = await Event.get(event_id);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('query GetEvent'),
                { id: event_id }
            );
            expect(result).toBeInstanceOf(Event);
            expect(result.id).toBe('event-123');
            expect(result.title).toBe('Test Event');
        });

        it('should return null if event not found', async () => {
            const event_id = 'event-123';

            const mockResponse = {
                data: {
                    events: []
                }
            };

            graphql.mockResolvedValueOnce(mockResponse);

            const result = await Event.get(event_id);

            expect(graphql).toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should handle GraphQL errors gracefully', async () => {
            const event_id = 'event-123';

            graphql.mockRejectedValueOnce(new Error('GraphQL error'));

            await expect(Event.get(event_id)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalled();
        });
    });
});

