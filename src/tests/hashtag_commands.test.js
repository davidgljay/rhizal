import { bot_message_hashtag } from "../helpers/hashtag_commands";
import Membership from "../models/membership";
import Script from "../models/script";

jest.mock("../models/membership");
jest.mock("../models/script");

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
});