const { set_admin, init_access_groups } = require('../initialization/script_sync');
const Membership = require('../models/membership');
const GroupThread = require('../models/group_thread');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

jest.mock('../models/membership');
jest.mock('../models/group_thread');
jest.mock('readline');
jest.mock('fs');
jest.mock('path');

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
        it('should create admin membership successfully', async () => {
            const mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            const mockAdminMembership = {
                id: 'membership_123',
                permissions: ['onboarding', 'group_comms', 'announcement'],
                step: 'done'
            };

            const mockAdminGroup = {
                id: 'group_thread_123',
                group_id: 'admin_group_id_123',
                permissions: ['onboarding', 'group_comms', 'announcement'],
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
            expect(result).toEqual({"admin_id": "membership_123", "admin_phone": "+0987654321"});
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
                permissions: ['onboarding', 'group_comms', 'announcement'],
                step: 'done'
            };

            const mockAdminGroup = {
                id: 'group_thread_123',
                group_id: 'admin_group_id_123',
                permissions: ['onboarding', 'group_comms', 'announcement'],
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
            expect(result).toEqual({"admin_id": "membership_123", "admin_phone": "+0987654321"});
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
    });

    describe('init_access_groups', () => {
        let mockCommunity;
        let mockCommunityConfig;
        let mockAdminPhone;

        beforeEach(() => {
            mockCommunity = {
                id: 'community_123',
                name: 'Test Community',
                bot_phone: '+1234567890'
            };

            mockAdminPhone = '+0987654321';

            mockCommunityConfig = {
                access_levels: {
                    admins: ['announcement', 'group_comms'],
                    delegates: ['group_comms'],
                    greeters: ['onboarding']
                }
            };

            // Mock fs.readFileSync to return YAML content
            fs.readFileSync.mockReturnValue(`
community:
  bot_phone: "+1234567890"
  name: "Test Community"
  access_levels:
    admins: 
      - announcement
      - group_comms
    delegates:
      - group_comms
    greeters:
      - onboarding
            `);

            // Mock path.join
            path.join.mockReturnValue('/mock/path/community_config.yml');
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should create access groups for all roles successfully', async () => {
            const mockGroupResults = [
                { id: 'group_1', group_id: 'admin_group_id', role: 'admins' },
                { id: 'group_2', group_id: 'delegate_group_id', role: 'delegates' },
                { id: 'group_3', group_id: 'greeter_group_id', role: 'greeters' }
            ];

            GroupThread.create_group_and_invite
                .mockResolvedValueOnce(mockGroupResults[0])
                .mockResolvedValueOnce(mockGroupResults[1])
                .mockResolvedValueOnce(mockGroupResults[2]);

            const consoleLogSpy = jest.spyOn(console, 'log');

            await init_access_groups(mockCommunity, mockAdminPhone);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledTimes(3);
            expect(GroupThread.create_group_and_invite).toHaveBeenNthCalledWith(1,
                'Test Community rhizal admins',
                '+1234567890',
                '+0987654321',
                ['announcement', 'group_comms'],
                mockCommunity,
                true,
                'admins'
            );
            expect(GroupThread.create_group_and_invite).toHaveBeenNthCalledWith(2,
                'Test Community rhizal delegates',
                '+1234567890',
                '+0987654321',
                ['group_comms'],
                mockCommunity,
                true,
                'delegates'
            );
            expect(GroupThread.create_group_and_invite).toHaveBeenNthCalledWith(3,
                'Test Community rhizal greeters',
                '+1234567890',
                '+0987654321',
                ['onboarding'],
                mockCommunity,
                true,
                'greeters'
            );

            expect(consoleLogSpy).toHaveBeenCalledWith('Creating admins group: Test Community rhizal admins');
            expect(consoleLogSpy).toHaveBeenCalledWith('Creating delegates group: Test Community rhizal delegates');
            expect(consoleLogSpy).toHaveBeenCalledWith('Creating greeters group: Test Community rhizal greeters');

            consoleLogSpy.mockRestore();
        });

        it('should handle group creation failure gracefully', async () => {
            const mockAdminMembership = { id: 'membership_123' };
            
            GroupThread.create_group_and_invite
                .mockResolvedValueOnce({ id: 'group_1', role: 'admins' })
                .mockRejectedValueOnce(new Error('Signal API error'));

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            await init_access_groups(mockCommunity, mockAdminPhone, mockAdminMembership);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating group:', expect.any(Error));

            consoleErrorSpy.mockRestore();
            consoleLogSpy.mockRestore();
        });

        it('should handle empty access levels configuration', async () => {
            mockCommunityConfig.access_levels = {};
            
            fs.readFileSync.mockReturnValue(`
community:
  bot_phone: "+1234567890"
  name: "Test Community"
  access_levels: {}
            `);

            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            await init_access_groups(mockCommunity, mockAdminPhone);

            expect(GroupThread.create_group_and_invite).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Creating'));

            consoleLogSpy.mockRestore();
        });

        it('should handle community config loading failure', async () => {
            fs.readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(init_access_groups(mockCommunity, mockAdminPhone)).rejects.toThrow('File not found');
            expect(GroupThread.create_group_and_invite).not.toHaveBeenCalled();
        });

        it('should create groups with correct naming convention for different community names', async () => {
            const communityWithSpaces = {
                ...mockCommunity,
                name: 'My Awesome Community'
            };

            GroupThread.create_group_and_invite.mockResolvedValue({ id: 'group_1' });

            await init_access_groups(communityWithSpaces, mockAdminPhone);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'My Awesome Community rhizal admins',
                '+1234567890',
                '+0987654321',
                ['announcement', 'group_comms'],
                communityWithSpaces,
                true,
                'admins'
            );
        });

        it('should handle special characters in community name', async () => {
            const communityWithSpecialChars = {
                ...mockCommunity,
                name: 'Community-Name_With.Special@Chars!'
            };

            GroupThread.create_group_and_invite.mockResolvedValue({ id: 'group_1' });

            await init_access_groups(communityWithSpecialChars, mockAdminPhone);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'Community-Name_With.Special@Chars! rhizal admins',
                '+1234567890',
                '+0987654321',
                ['announcement', 'group_comms'],
                communityWithSpecialChars,
                true,
                'admins'
            );
        });

        it('should handle undefined admin_phone parameter', async () => {
            GroupThread.create_group_and_invite.mockResolvedValue({ id: 'group_1' });

            await init_access_groups(mockCommunity, undefined);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'Test Community rhizal admins',
                '+1234567890',
                undefined,
                ['announcement', 'group_comms'],
                mockCommunity,
                true,
                'admins'
            );
        });

        it('should handle null admin_phone parameter', async () => {
            GroupThread.create_group_and_invite.mockResolvedValue({ id: 'group_1' });

            await init_access_groups(mockCommunity, null);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledWith(
                'Test Community rhizal admins',
                '+1234567890',
                null,
                ['announcement', 'group_comms'],
                mockCommunity,
                true,
                'admins'
            );
        });

        it('should handle access levels with empty arrays', async () => {
            mockCommunityConfig.access_levels = {
                admins: [],
                delegates: ['group_comms']
            };

            fs.readFileSync.mockReturnValue(`
community:
  bot_phone: "+1234567890"
  name: "Test Community"
  access_levels:
    admins: []
    delegates:
      - group_comms
            `);

            GroupThread.create_group_and_invite.mockResolvedValue({ id: 'group_1' });

            await init_access_groups(mockCommunity, mockAdminPhone);

            expect(GroupThread.create_group_and_invite).toHaveBeenCalledTimes(2);
            expect(GroupThread.create_group_and_invite).toHaveBeenNthCalledWith(1,
                'Test Community rhizal admins',
                '+1234567890',
                '+0987654321',
                [],
                mockCommunity,
                true,
                'admins'
            );
            expect(GroupThread.create_group_and_invite).toHaveBeenNthCalledWith(2,
                'Test Community rhizal delegates',
                '+1234567890',
                '+0987654321',
                ['group_comms'],
                mockCommunity,
                true,
                'delegates'
            );
        });

        it('should handle community config with missing access_levels', async () => {
            fs.readFileSync.mockReturnValue(`
community:
  bot_phone: "+1234567890"
  name: "Test Community"
            `);

            await expect(init_access_groups(mockCommunity, mockAdminPhone)).rejects.toThrow();
        });

        it('should handle community config with null access_levels', async () => {
            fs.readFileSync.mockReturnValue(`
community:
  bot_phone: "+1234567890"
  name: "Test Community"
  access_levels: null
            `);

            await expect(init_access_groups(mockCommunity, mockAdminPhone)).rejects.toThrow();
        });
    });
});