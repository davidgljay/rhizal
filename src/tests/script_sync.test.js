const { set_admin } = require('../initialization/script_sync');
const Membership = require('../models/membership');
const GroupThread = require('../models/group_thread');
const readline = require('readline');

jest.mock('../models/membership');
jest.mock('../models/group_thread');
jest.mock('readline');

describe('Script Sync - Admin Group Creation', () => {
    let mockReadlineInterface;
    let mockQuestion;

    beforeEach(() => {
        mockQuestion = jest.fn();
        mockReadlineInterface = {
            question: mockQuestion,
            close: jest.fn()
        };
        readline.createInterface.mockReturnValue(mockReadlineInterface);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('set_admin', () => {
        it('should create admin membership and admin group successfully', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            const mockAdminMembership = {
                id: 'membership_123',
                type: 'admin',
                step: 'done'
            };

            const mockAdminGroup = {
                id: 'group_thread_123',
                group_id: 'admin_group_id_123',
                role: 'admin',
                step: 'done'
            };

            Membership.create_admin.mockResolvedValue(mockAdminMembership);
            GroupThread.create_group_and_invite.mockResolvedValue(mockAdminGroup);

            // Mock the readline question to resolve with a phone number
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('+0987654321');
            });

            const result = await set_admin(mockCommunity);

            expect(Membership.create_admin).toHaveBeenCalledWith('+0987654321', mockCommunity);
            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'Test Community Rhizal Admins',
                '+1234567890',
                '+0987654321',
                mockCommunity
            );
            expect(result).toEqual({
                admin_membership: mockAdminMembership,
                admin_group: mockAdminGroup
            });
        });

        it('should handle admin group creation failure gracefully', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            const mockAdminMembership = {
                id: 'membership_123',
                type: 'admin',
                step: 'done'
            };

            Membership.create_admin.mockResolvedValue(mockAdminMembership);
            GroupThread.create_group_and_invite.mockRejectedValue(new Error('Signal API error'));

            // Mock console methods
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            // Mock the readline question to resolve with a phone number
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('+0987654321');
            });

            const result = await set_admin(mockCommunity);

            expect(Membership.create_admin).toHaveBeenCalledWith('+0987654321', mockCommunity);
            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'Test Community Rhizal Admins',
                '+1234567890',
                '+0987654321',
                mockCommunity
            );
            expect(result).toEqual({
                admin_membership: mockAdminMembership,
                admin_group: null
            });
            expect(consoleSpy).toHaveBeenCalledWith('Error creating admin group:', expect.any(Error));
            expect(consoleLogSpy).toHaveBeenCalledWith('Continuing without admin group...');

            consoleSpy.mockRestore();
            consoleLogSpy.mockRestore();
        });

        it('should handle empty phone number input', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            // Mock the readline question to resolve with empty string
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('');
            });

            await expect(set_admin(mockCommunity)).rejects.toThrow('No phone number entered.');

            expect(Membership.create_admin).not.toHaveBeenCalled();
            expect(GroupThread.create_group_and_invite).not.toHaveBeenCalled();
        });

        it('should handle whitespace-only phone number input', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            // Mock the readline question to resolve with whitespace
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('   ');
            });

            await expect(set_admin(mockCommunity)).rejects.toThrow('No phone number entered.');

            expect(Membership.create_admin).not.toHaveBeenCalled();
            expect(GroupThread.create_group_and_invite).not.toHaveBeenCalled();
        });

        it('should trim phone number input', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            const mockAdminMembership = {
                id: 'membership_123',
                type: 'admin',
                step: 'done'
            };

            const mockAdminGroup = {
                id: 'group_thread_123',
                group_id: 'admin_group_id_123',
                role: 'admin',
                step: 'done'
            };

            Membership.create_admin.mockResolvedValue(mockAdminMembership);
            GroupThread.create_group_and_invite.mockResolvedValue(mockAdminGroup);

            // Mock the readline question to resolve with phone number with whitespace
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('  +0987654321  ');
            });

            const result = await set_admin(mockCommunity);

            expect(Membership.create_admin).toHaveBeenCalledWith('+0987654321', mockCommunity);
            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'Test Community Rhizal Admins',
                '+1234567890',
                '+0987654321',
                mockCommunity
            );
            expect(result).toEqual({
                admin_membership: mockAdminMembership,
                admin_group: mockAdminGroup
            });
        });

        it('should handle admin membership creation failure', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            Membership.create_admin.mockRejectedValue(new Error('Database error'));

            // Mock the readline question to resolve with a phone number
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('+0987654321');
            });

            await expect(set_admin(mockCommunity)).rejects.toThrow('Database error');

            expect(Membership.create_admin).toHaveBeenCalledWith('+0987654321', mockCommunity);
            expect(GroupThread.create_group_and_invite).not.toHaveBeenCalled();
        });

        it('should create admin group with correct naming convention', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'My Awesome Community',
                bot_phone: '+1234567890'
            };

            const mockAdminMembership = {
                id: 'membership_123',
                type: 'admin',
                step: 'done'
            };

            const mockAdminGroup = {
                id: 'group_thread_123',
                group_id: 'admin_group_id_123',
                role: 'admin',
                step: 'done'
            };

            Membership.create_admin.mockResolvedValue(mockAdminMembership);
            GroupThread.create_group_and_invite.mockResolvedValue(mockAdminGroup);

            // Mock the readline question to resolve with a phone number
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('+0987654321');
            });

            await set_admin(mockCommunity);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'My Awesome Community Rhizal Admins',
                '+1234567890',
                '+0987654321',
                mockCommunity
            );
        });

        it('should log admin membership creation', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            const mockAdminMembership = {
                id: 'membership_123',
                type: 'admin',
                step: 'done'
            };

            const mockAdminGroup = {
                id: 'group_thread_123',
                group_id: 'admin_group_id_123',
                role: 'admin',
                step: 'done'
            };

            Membership.create_admin.mockResolvedValue(mockAdminMembership);
            GroupThread.create_group_and_invite.mockResolvedValue(mockAdminGroup);

            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            // Mock the readline question to resolve with a phone number
            mockQuestion.mockImplementation((prompt, callback) => {
                callback('+0987654321');
            });

            await set_admin(mockCommunity);

            expect(consoleLogSpy).toHaveBeenCalledWith('Admin membership created with id:', 'membership_123');
            expect(consoleLogSpy).toHaveBeenCalledWith('Creating admin group: Test Community Rhizal Admins');
            expect(consoleLogSpy).toHaveBeenCalledWith('Admin group created with id:', 'group_thread_123');

            consoleLogSpy.mockRestore();
        });
    });
});