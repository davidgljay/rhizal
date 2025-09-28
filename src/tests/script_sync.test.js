const fs = require('fs');
const path = require('path');

// Mock the fs module
jest.mock('fs');

// Mock the path module
jest.mock('path');

// Mock the Community model
jest.mock('../models/community', () => ({
    get: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
}));

// Mock the Script model
jest.mock('../models/script', () => ({
    get: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
}));

// Import the functions after mocking
const { update_community_and_scripts, create_or_update_community, create_or_update_script } = require('../initialization/script_sync');
const Community = require('../models/community');
const Script = require('../models/script');

describe('script_sync.js', () => {
    let mockCommunity;
    let mockScript;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock path.join
        path.join.mockImplementation((...args) => args.join('/'));
        
        // Mock fs.readFileSync
        fs.readFileSync.mockReturnValue('mock file content');
        
        // Mock Community instance
        mockCommunity = {
            id: 'mock-community-id',
            bot_phone: '+1234567890',
            name: 'Test Community'
        };
        
        // Mock Script instance
        mockScript = {
            id: 'mock-script-id',
            name: 'onboarding',
            community_id: 'mock-community-id',
            script_json: 'mock script content'
        };
    });

    describe('create_or_update_community', () => {
        it('should update existing community', async () => {
            const mockConfig = 'bot_phone: +1234567890\nname: Test Community';
            fs.readFileSync.mockReturnValue(mockConfig);
            
            Community.get.mockResolvedValue(mockCommunity);
            Community.update.mockResolvedValue(mockCommunity);

            const result = await create_or_update_community();

            expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('scripts_config/community_config.yml'), 'utf8');
            expect(Community.get).toHaveBeenCalledWith(mockConfig.bot_phone);
            expect(Community.update).toHaveBeenCalledWith(mockConfig);
            expect(Community.create).not.toHaveBeenCalled();
            expect(result).toBe(mockCommunity);
        });

        it('should create new community when not found', async () => {
            const mockConfig = 'bot_phone: +1234567890\nname: Test Community';
            fs.readFileSync.mockReturnValue(mockConfig);
            
            Community.get.mockResolvedValue(null);
            Community.create.mockResolvedValue(mockCommunity);

            const result = await create_or_update_community();

            expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('/scripts_config/community_config.yml'), 'utf8');
            expect(Community.get).toHaveBeenCalledWith(mockConfig.bot_phone);
            expect(Community.create).toHaveBeenCalledWith(mockConfig);
            expect(Community.update).not.toHaveBeenCalled();
            expect(result).toBe(mockCommunity);
        });

        it('should handle community operations errors', async () => {
            const mockConfig = 'bot_phone: +1234567890\nname: Test Community';
            fs.readFileSync.mockReturnValue(mockConfig);
            
            Community.get.mockRejectedValue(new Error('Database error'));

            await expect(create_or_update_community()).rejects.toThrow('Database error');
        });
    });

    describe('create_or_update_script', () => {
        it('should update existing script', async () => {
            const scriptConfig = {
                name: 'onboarding',
                community_id: 'mock-community-id',
                script_json: 'mock script content'
            };
            
            Script.get.mockResolvedValue(mockScript);
            Script.update.mockResolvedValue(mockScript);

            const result = await create_or_update_script(scriptConfig);

            expect(Script.get).toHaveBeenCalledWith(scriptConfig.name);
            expect(Script.update).toHaveBeenCalledWith(scriptConfig);
            expect(Script.create).not.toHaveBeenCalled();
            expect(result).toBe(mockScript);
        });

        it('should create new script when not found', async () => {
            const scriptConfig = {
                name: 'onboarding',
                community_id: 'mock-community-id',
                script_json: 'mock script content'
            };
            
            Script.get.mockResolvedValue(null);
            Script.create.mockResolvedValue(mockScript);

            const result = await create_or_update_script(scriptConfig);

            expect(Script.get).toHaveBeenCalledWith(scriptConfig.name);
            expect(Script.create).toHaveBeenCalledWith(scriptConfig);
            expect(Script.update).not.toHaveBeenCalled();
            expect(result).toBe(mockScript);
        });

        it('should handle script operations errors', async () => {
            const scriptConfig = {
                name: 'onboarding',
                community_id: 'mock-community-id',
                script_json: 'mock script content'
            };
            
            Script.get.mockRejectedValue(new Error('Script database error'));

            await expect(create_or_update_script(scriptConfig)).rejects.toThrow('Script database error');
        });
    });

    describe('update_community_and_scripts', () => {

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should successfully update community and all scripts', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            const mockOnboardingScript = 'mock onboarding script content';
            const mockGroupScript = 'mock group script content';
            
            // Mock file reads
            fs.readFileSync
                .mockReturnValueOnce('mock community config')
                .mockReturnValueOnce(mockOnboardingScript)
                .mockReturnValueOnce(mockGroupScript);
            
            // Mock Community operations
            Community.get.mockResolvedValue(null);
            Community.create.mockResolvedValue(mockCommunity);
            
            // Mock Script operations
            Script.get.mockResolvedValue(null);
            Script.create.mockResolvedValue(mockScript);

            await update_community_and_scripts();

            // Verify community creation
            expect(Community.create).toHaveBeenCalledWith('mock community config');
            
            // Verify script creations
            expect(Script.create).toHaveBeenCalledTimes(2);
            expect(Script.create).toHaveBeenCalledWith({
                name: 'onboarding',
                community_id: mockCommunity.id,
                script_json: mockOnboardingScript
            });
            expect(Script.create).toHaveBeenCalledWith({
                name: 'group_thread',
                community_id: mockCommunity.id,
                script_json: mockGroupScript
            });
            
            // Verify console logs
            expect(consoleSpy).toHaveBeenCalledWith('Community and scripts updated');
            expect(consoleSpy).toHaveBeenCalledWith(mockCommunity);
            expect(consoleSpy).toHaveBeenCalledWith(mockScript);
            expect(consoleSpy).toHaveBeenCalledWith(mockScript);
            
            consoleSpy.mockRestore();
        });

        it('should handle file read errors', async () => {
            fs.readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(update_community_and_scripts()).rejects.toThrow('File not found');
        });

        it('should handle community creation errors', async () => {
            fs.readFileSync.mockReturnValue('mock community config');
            Community.get.mockRejectedValue(new Error('Community creation failed'));

            await expect(update_community_and_scripts()).rejects.toThrow('Community creation failed');
        });

        it('should handle script creation errors', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            fs.readFileSync
                .mockReturnValueOnce('mock community config')
                .mockReturnValueOnce('mock onboarding script')
                .mockReturnValueOnce('mock group script');
            
            Community.get.mockResolvedValue(null);
            Community.create.mockResolvedValue(mockCommunity);
            
            Script.get.mockResolvedValue(null);
            Script.create.mockRejectedValue(new Error('Script creation failed'));

            await expect(update_community_and_scripts()).rejects.toThrow('Script creation failed');
            
            consoleSpy.mockRestore();
        });

        it('should update existing community and scripts', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            fs.readFileSync
                .mockReturnValueOnce('mock community config')
                .mockReturnValueOnce('mock onboarding script')
                .mockReturnValueOnce('mock group script')
            
            // Mock existing community and scripts
            Community.get.mockResolvedValue(mockCommunity);
            Community.update.mockResolvedValue(mockCommunity);
            
            Script.get.mockResolvedValue(mockScript);
            Script.update.mockResolvedValue(mockScript);

            await update_community_and_scripts();

            // Verify updates instead of creates
            expect(Community.update).toHaveBeenCalledWith('mock community config');
            expect(Script.update).toHaveBeenCalledTimes(2);
            
            consoleSpy.mockRestore();
        });
    });

    describe('Integration scenarios', () => {
        it('should handle mixed create/update scenarios', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            fs.readFileSync
                .mockReturnValueOnce('mock community config')
                .mockReturnValueOnce('mock onboarding script')
                .mockReturnValueOnce('mock group script');
            
            // Community exists, onboarding script exists, group script is new
            Community.get.mockResolvedValue(mockCommunity);
            Community.update.mockResolvedValue(mockCommunity);
            
            Script.get
                .mockResolvedValueOnce(mockScript) // onboarding exists
                .mockResolvedValueOnce(null); // group_thread is new
            
            Script.update.mockResolvedValue(mockScript);
            Script.create.mockResolvedValue(mockScript);

            await update_community_and_scripts();

            expect(Community.update).toHaveBeenCalled();
            expect(Script.update).toHaveBeenCalledTimes(1); // onboarding
            expect(Script.create).toHaveBeenCalledTimes(1); // group_thread
            
            consoleSpy.mockRestore();
        });
    });
});
