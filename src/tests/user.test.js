const User = require('../models/user');
const { graphql } = require('../apis/graphql');

jest.mock('../apis/graphql');

describe('User Model', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('set_variable', () => {
        it('should throw an error for an invalid variable', async () => {
            await expect(User.set_variable('123', 'invalidVar', 'value')).rejects.toThrow('Invalid variable. Valid variables are: fname, fullname, location, email');
        });

        it('should call graphql with correct mutation and variables', async () => {
            graphql.mockResolvedValue({ data: { updateUserVariable: { id: '123', fname: 'John' } } });

            await User.set_variable('123', 'fname', 'John');

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('mutation updateUserVariable'), { id: '123', value: 'John' });
        });

        it('should log an error if graphql request fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL Error'));

            await User.set_variable('123', 'fname', 'John');

            expect(consoleSpy).toHaveBeenCalledWith('Error updating user fname:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('create', () => {
        it('should call graphql with correct mutation and variables', async () => {
            graphql.mockResolvedValue({ data: { createUser: { id: '123', phone: '1234567890' } } });

            await User.create('1234567890');

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('mutation createUser'), { phone: '1234567890' });
        });

        it('should return a user object', async () => {
            graphql.mockResolvedValue({ data: { createUser: { id: '123', phone: '1234567890' } } });

            const user = await User.create('1234567890');

            expect(user).toBeInstanceOf(User);
            expect(user.id).toBe('123');
            expect(user.phone).toBe('1234567890');
        });

        it('should log an error if graphql request fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL Error'));

            await User.create('1234567890');

            expect(consoleSpy).toHaveBeenCalledWith('Error creating user:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});