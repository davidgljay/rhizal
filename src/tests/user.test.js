import { graphql } from '../apis/graphql';
import User from '../models/user';

jest.mock('../apis/graphql');

describe('User', () => {
    let user;

    beforeEach(() => {
        user = new User();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should populate user data when the response is successful', async () => {
            const mockResponse = {
                data: {
                    user: {
                        id: '1',
                        script: 'test script',
                        status: 'active',
                        phone: '1234567890',
                        created_time: '2023-01-01T00:00:00Z',
                        fname: 'John',
                        lname: 'Doe',
                        location: 'Test Location',
                        email: 'john.doe@example.com',
                    },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            await user.get('1234567890');

            expect(user.id).toBe('1');
            expect(user.script).toBe('test script');
            expect(user.status).toBe('active');
            expect(user.phone).toBe('1234567890');
            expect(user.created_time).toBe('2023-01-01T00:00:00Z');
            expect(user.profile).toEqual({
                fname: 'John',
                lname: 'Doe',
                location: 'Test Location',
                email: 'john.doe@example.com',
            });
        });

        it('should log an error when the response is unsuccessful', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL error'));

            await user.get('1234567890');

            expect(consoleSpy).toHaveBeenCalledWith('Error fetching user data:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('set_profile', () => {
        it('should update user profile when the response is successful', async () => {
            user.id = '1';
            const mockResponse = {
                data: {
                    updateUserProfile: {
                        profile: {
                            fname: 'Jane',
                            lname: 'Doe',
                            location: 'New Location',
                            email: 'jane.doe@example.com',
                        },
                    },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const profileData = {
                fname: 'Jane',
                lname: 'Doe',
                location: 'New Location',
                email: 'jane.doe@example.com',
            };
            await user.set_profile(profileData);

            expect(user.profile).toEqual(profileData);
        });

        it('should throw an error if user data has not been populated', async () => {
            await expect(user.set_profile({})).rejects.toThrow('User data has not been populated.');
        });

        it('should log an error when the response is unsuccessful', async () => {
            user.id = '1';
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL error'));

            await user.set_profile({});

            expect(consoleSpy).toHaveBeenCalledWith('Error updating user profile:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('set_status', () => {
        it('should update user status when the response is successful', async () => {
            user.id = '1';
            const mockResponse = {
                data: {
                    updateUserStatus: {
                        script: 'new script',
                        status: 'inactive',
                    },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            await user.set_status('new script', 'inactive');

            expect(user.script).toBe('new script');
            expect(user.status).toBe('inactive');
        });

        it('should throw an error if user data has not been populated', async () => {
            await expect(user.set_status('new script', 'inactive')).rejects.toThrow('User data has not been populated.');
        });

        it('should log an error when the response is unsuccessful', async () => {
            user.id = '1';
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL error'));

            await user.set_status('new script', 'inactive');

            expect(consoleSpy).toHaveBeenCalledWith('Error updating user status:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
    describe('create', () => {
        it('should create a new user when the response is successful', async () => {
            const mockResponse = {
                data: {
                    createUser: {
                        id: '1',
                        phone: '1234567890',
                    },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const newUser = await User.create('1234567890');

            expect(newUser.id).toBe('1');
            expect(newUser.phone).toBe('1234567890');
        });

        it('should log an error when the response is unsuccessful', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL error'));

            await User.create('1234567890');

            expect(consoleSpy).toHaveBeenCalledWith('Error creating user:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});