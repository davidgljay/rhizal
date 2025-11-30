import { bot_message_hashtag } from "../helpers/hashtag_commands";
import Membership from "../models/membership";
import Script from "../models/script";
import GroupThread from "../models/group_thread";

jest.mock("../models/membership");
jest.mock("../models/script");
jest.mock("../models/group_thread");

describe("bot_message_hashtag", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("#announcement", () => {

        it("should handle #announcement hashtag correctly", async () => {
            const mockMembership = { id: 1 , permissions: ['announcement']};
            const mockCommunity = {};
            const mockMessage = "Test message";
            const mockScript = {
                id: 123,
                get_vars: jest.fn(),
                send: jest.fn(),
            };

            Script.get_system_script = jest.fn().mockResolvedValue(mockScript);
            Membership.set_variable = jest.fn();

            const send_message = await bot_message_hashtag("#announcement", mockMembership, mockCommunity, mockMessage);

            expect(send_message).toBe(true);
            expect(Script.get_system_script).toHaveBeenCalledWith("announcement");
            expect(Membership.set_variable).toHaveBeenCalledWith(mockMembership.id, "current_script_id", mockScript.id);
            expect(Membership.set_variable).toHaveBeenCalledWith(mockMembership.id, "step", "0");
            expect(mockScript.get_vars).toHaveBeenCalledWith(mockMembership, mockMessage);
            expect(mockScript.send).toHaveBeenCalledWith("0");
        });

        it("should return false if member does not have announcement permission", async () => {
            const mockMembership = { id: 1, permissions: [] };
            const mockCommunity = {};
            const mockMessage = "Test message";

            const result = await bot_message_hashtag("#announcement", mockMembership, mockCommunity, mockMessage);

            expect(result).toBe(false);
            expect(Membership.set_variable).not.toHaveBeenCalled();
        });

        it("should do nothing if system script for #announcement is not found", async () => {
            const mockMembership = { id: 1 , permissions: ['announcement'] };
            const mockCommunity = {};
            const mockMessage = "Test message";

            Script.get_system_script = jest.fn().mockResolvedValue(null);
            Membership.set_variable = jest.fn();

            await bot_message_hashtag("#announcement", mockMembership, mockCommunity, mockMessage);

            expect(Script.get_system_script).toHaveBeenCalledWith("announcement");
            expect(Membership.set_variable).not.toHaveBeenCalled();
        });

        it("should do nothing for unsupported hashtags", async () => {
            const mockMembership = { id: 1 };
            const mockCommunity = {};
            const mockMessage = "Test message";

            await bot_message_hashtag("#unsupported", mockMembership, mockCommunity, mockMessage);

            expect(Membership.set_variable).not.toHaveBeenCalled();
        }); 
    });

    describe("#name", () => {
        it("should handle #name hashtag correctly", async () => {
            const mockMembership = { id: 1, permissions: ['group_comms'] };
            const mockCommunity = {};
            const mockMessage = "Test message";
            const mockGroupThread = { group_id: 'group_thread_123', group_id: 'group_456' };
            const mockGroupNameScript = {
                id: 789,
                vars: {},
                get_vars: jest.fn(),
                send: jest.fn(),
            };

            Script.get = jest.fn().mockResolvedValue(mockGroupNameScript);
            GroupThread.set_variable = jest.fn();

            const result = await bot_message_hashtag("#name", mockMembership, mockCommunity, mockMessage, mockGroupThread);

            expect(result).toBe(true);
            expect(Script.get).toHaveBeenCalledWith("group_thread");
            expect(GroupThread.set_variable).toHaveBeenCalledWith(mockGroupThread.group_id, "step", "0");
            expect(mockGroupNameScript.get_vars).toHaveBeenCalledWith(mockMembership, mockMessage);
            expect(mockGroupNameScript.vars.group_id).toBe(mockGroupThread.group_id);
            expect(mockGroupNameScript.send).toHaveBeenCalledWith("0");
        });

        it("should return false if member does not have group_comms permission", async () => {
            const mockMembership = { id: 1, permissions: [] };
            const mockCommunity = {};
            const mockMessage = "Test message";
            const mockGroupThread = { id: 'group_thread_123', group_id: 'group_456' };

            const result = await bot_message_hashtag("#name", mockMembership, mockCommunity, mockMessage, mockGroupThread);

            expect(result).toBe(false);
            expect(GroupThread.set_variable).not.toHaveBeenCalled();
        });
    });

    describe("#event", () => {
        it("should handle #event hashtag correctly", async () => {
            const mockMembership = { id: 1, permissions: ['announcement'] };
            const mockCommunity = {};
            const mockMessage = "Test message";
            const mockAnnouncementScript = {
                id: 100,
                get_vars: jest.fn(),
                send: jest.fn(),
            };
            const mockEventScript = {
                id: 123,
                get_vars: jest.fn(),
                send: jest.fn(),
            };

            Script.get_system_script = jest.fn()
                .mockResolvedValueOnce(mockAnnouncementScript) // First call for announcement script at top
                .mockResolvedValueOnce(mockEventScript); // Second call for event_config
            Membership.set_variable = jest.fn();

            const result = await bot_message_hashtag("#event", mockMembership, mockCommunity, mockMessage);

            expect(result).toBe(true);
            expect(Script.get_system_script).toHaveBeenCalledWith("announcement");
            expect(Script.get_system_script).toHaveBeenCalledWith("event_config");
            expect(Membership.set_variable).toHaveBeenCalledWith(mockMembership.id, "current_script_id", mockEventScript.id);
            expect(Membership.set_variable).toHaveBeenCalledWith(mockMembership.id, "step", "0");
            expect(mockEventScript.get_vars).toHaveBeenCalledWith(mockMembership, mockMessage);
            expect(mockEventScript.send).toHaveBeenCalledWith("0");
        });

        it("should return false if member does not have announcement permission", async () => {
            const mockMembership = { id: 1, permissions: [] };
            const mockCommunity = {};
            const mockMessage = "Test message";
            const mockAnnouncementScript = {
                id: 100,
                get_vars: jest.fn(),
                send: jest.fn(),
            };

            Script.get_system_script = jest.fn().mockResolvedValue(mockAnnouncementScript);
            Membership.set_variable = jest.fn();

            const result = await bot_message_hashtag("#event", mockMembership, mockCommunity, mockMessage);

            expect(result).toBe(false);
            expect(Script.get_system_script).toHaveBeenCalledWith("announcement");
            expect(Script.get_system_script).not.toHaveBeenCalledWith("event_config");
            expect(Membership.set_variable).not.toHaveBeenCalled();
        });

        it("should do nothing if system script for #event is not found", async () => {
            const mockMembership = { id: 1, permissions: ['announcement'] };
            const mockCommunity = {};
            const mockMessage = "Test message";
            const mockAnnouncementScript = {
                id: 100,
                get_vars: jest.fn(),
                send: jest.fn(),
            };

            Script.get_system_script = jest.fn()
                .mockResolvedValueOnce(mockAnnouncementScript) // First call for announcement script at top
                .mockResolvedValueOnce(null); // Second call for event_config returns null
            Membership.set_variable = jest.fn().mockResolvedValue(undefined);

            const result = await bot_message_hashtag("#event", mockMembership, mockCommunity, mockMessage);

            expect(Script.get_system_script).toHaveBeenCalledWith("announcement");
            expect(Script.get_system_script).toHaveBeenCalledWith("event_config");
            expect(Membership.set_variable).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });
    });
});