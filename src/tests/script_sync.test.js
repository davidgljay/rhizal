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
jest.mock('ws');

const WebSocket = require('ws');

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
            const mockAdminMembership = { id: 'membership_123' };
            Membership.create_admin.mockResolvedValue(mockAdminMembership);
            const mockAdminPhone = '+0987654321';
            const mockAdminName = 'John Doe';
            const mockCommunity = { id: 'community_123', bot_phone: '+1234567890' };
            const mockRhizalUsername = 'rhizal_username';
            const mockMessage = { envelope: { sourceUuid: mockAdminPhone, dataMessage: { message: 'test message' } } }; 
            
            // Mock WebSocket for signal message simulation
            const wsOnHandlers = {};
            const mockWebSocketInstance = {
                on: jest.fn((event, handler) => {
                    wsOnHandlers[event] = handler;
                    return mockWebSocketInstance;
                }),
                close: jest.fn(),
                readyState: 1 // WebSocket.OPEN
            };
            WebSocket.mockImplementation(() => mockWebSocketInstance);

            // Each call to createInterface returns the same mock interface, but we need to handle two sequential questions
            // Callbacks are called synchronously to immediately resolve the promises
            let callCount = 0;
            mockQuestion.mockImplementation((prompt, cb) => {
                callCount++;
                // Call callback asynchronously to match readline's behavior
                setImmediate(() => {
                    if (callCount === 1) {
                        cb(mockAdminPhone);
                    } else if (callCount === 2) {
                        cb(mockAdminName);
                    }
                });
            });

            // Call set_admin and mock a signal message being received
            const setAdminPromise = set_admin(mockCommunity, mockRhizalUsername);

            // Wait for readline promises to resolve (they use setImmediate)
            await new Promise(resolve => setImmediate(resolve));
            await new Promise(resolve => setImmediate(resolve));
            
            // Now wait for the WebSocket to be set up
            await Promise.resolve();
            
            // Simulate the WebSocket 'message' event as if a signal message was received with sourceUuid
            if (wsOnHandlers['message']) {
                wsOnHandlers['message'](JSON.stringify(mockMessage));
            }

            const result = await setAdminPromise;

            expect(result).toHaveProperty('admin_phone', mockAdminPhone);
            expect(result).toHaveProperty('admin_id', mockAdminMembership.id);
            expect(Membership.create_admin).toHaveBeenCalledWith(mockAdminPhone, mockCommunity);
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