/**
 * Mock for Signal CLI REST API
 * Provides mock implementations of all Signal API methods used in apis/signal.js
 * Can be configured to return expected results or simulate errors
 */

class SignalCliRestApiMock {
    constructor() {
        this.reset();
    }

    /**
     * Reset all mock state to defaults
     */
    reset() {
        this.sendShouldError = false;
        this.sendError = null;
        this.sendTimestamp = Date.now();
        
        this.leaveGroupShouldError = false;
        this.leaveGroupError = null;
        
        this.showTypingIndicatorShouldError = false;
        this.showTypingIndicatorError = null;
        
        this.emojiReactionShouldError = false;
        this.emojiReactionError = null;
        
        this.getGroupInfoShouldError = false;
        this.getGroupInfoError = null;
        this.groupInfoData = { members: [] };
        
        this.clearLocalStorageCalled = false;
        
        // Reset Jest mock function call history
        this.send.mockClear();
        this.leave_group.mockClear();
        this.show_typing_indicator.mockClear();
        this.emoji_reaction.mockClear();
        this.get_group_info.mockClear();
    }

    /**
     * Mock implementation of send method
     * @param {Array<string>} recipients - Array of recipient phone numbers or group IDs
     * @param {string} from_number - Bot phone number
     * @param {string} message - Message text
     * @returns {Promise<{timestamp: number}>} - Returns timestamp or throws error
     */
    send = jest.fn(async (recipients, from_number, message) => {
        if (!Array.isArray(recipients)) {
            throw new Error('Recipients must be an array');
        }
        
        if (this.sendShouldError) {
            const error = this.sendError || new Error('Error sending message');
            throw error;
        }
        
        this.clearLocalStorageCalled = true;
        return { timestamp: this.sendTimestamp };
    })

    /**
     * Mock implementation of leave_group method
     * @param {string} group_id - Group ID
     * @param {string} bot_number - Bot phone number
     * @returns {Promise<void>} - Returns void or throws error
     */
    leave_group = jest.fn(async (group_id, bot_number) => {
        if (this.leaveGroupShouldError) {
            const error = this.leaveGroupError || new Error('Error leaving group');
            throw error;
        }
        return Promise.resolve();
    })

    /**
     * Mock implementation of show_typing_indicator method
     * @param {string} to_phone - Recipient phone number
     * @param {string} from_phone - Bot phone number
     * @returns {Promise<void>} - Returns void or throws error
     */
    show_typing_indicator = jest.fn(async (to_phone, from_phone) => {
        if (this.showTypingIndicatorShouldError) {
            const error = this.showTypingIndicatorError || new Error('Error sending typing indicator');
            throw error;
        }
        return Promise.resolve();
    })

    /**
     * Mock implementation of emoji_reaction method
     * @param {string} to_phone - Target phone number
     * @param {string} from_phone - Bot phone number
     * @param {number} message_timestamp - Message timestamp
     * @param {string} emoji - Emoji to react with
     * @param {string} group_id - Optional group ID
     * @returns {Promise<void>} - Returns void or throws error
     */
    emoji_reaction = jest.fn(async (to_phone, from_phone, message_timestamp, emoji, group_id) => {
        if (this.emojiReactionShouldError) {
            const error = this.emojiReactionError || new Error('Error sending emoji reaction');
            throw error;
        }
        return Promise.resolve();
    })

    /**
     * Mock implementation of get_group_info method
     * @param {string} bot_phone - Bot phone number
     * @param {string} group_id - Group ID
     * @returns {Promise<{members: Array<string>}>} - Returns group info or throws error
     */
    get_group_info = jest.fn(async (bot_phone, group_id) => {
        if (this.getGroupInfoShouldError) {
            const error = this.getGroupInfoError || new Error('Error getting group info');
            return error;
        }
        return Promise.resolve(this.groupInfoData);
    })

    /**
     * Mock implementation of clear_local_storage method
     * This is called internally by send, but can be called directly for testing
     */
    clear_local_storage() {
        this.clearLocalStorageCalled = true;
    }

    /**
     * Configure send to return an error
     * @param {Error} error - Optional custom error, defaults to generic error
     */
    setSendError(error = null) {
        this.sendShouldError = true;
        this.sendError = error;
    }

    /**
     * Configure send to succeed
     * @param {number} timestamp - Optional timestamp to return
     */
    setSendSuccess(timestamp = null) {
        this.sendShouldError = false;
        this.sendError = null;
        if (timestamp !== null) {
            this.sendTimestamp = timestamp;
        }
    }

    /**
     * Configure leave_group to return an error
     * @param {Error} error - Optional custom error
     */
    setLeaveGroupError(error = null) {
        this.leaveGroupShouldError = true;
        this.leaveGroupError = error;
    }

    /**
     * Configure leave_group to succeed
     */
    setLeaveGroupSuccess() {
        this.leaveGroupShouldError = false;
        this.leaveGroupError = null;
    }

    /**
     * Configure show_typing_indicator to return an error
     * @param {Error} error - Optional custom error
     */
    setShowTypingIndicatorError(error = null) {
        this.showTypingIndicatorShouldError = true;
        this.showTypingIndicatorError = error;
    }

    /**
     * Configure show_typing_indicator to succeed
     */
    setShowTypingIndicatorSuccess() {
        this.showTypingIndicatorShouldError = false;
        this.showTypingIndicatorError = null;
    }

    /**
     * Configure emoji_reaction to return an error
     * @param {Error} error - Optional custom error
     */
    setEmojiReactionError(error = null) {
        this.emojiReactionShouldError = true;
        this.emojiReactionError = error;
    }

    /**
     * Configure emoji_reaction to succeed
     */
    setEmojiReactionSuccess() {
        this.emojiReactionShouldError = false;
        this.emojiReactionError = null;
    }

    /**
     * Configure get_group_info to return an error
     * @param {Error} error - Optional custom error
     */
    setGetGroupInfoError(error = null) {
        this.getGroupInfoShouldError = true;
        this.getGroupInfoError = error;
    }

    /**
     * Configure get_group_info to succeed
     * @param {Object} groupInfo - Group info data with members array
     */
    setGetGroupInfoSuccess(groupInfo = null) {
        this.getGroupInfoShouldError = false;
        this.getGroupInfoError = null;
        if (groupInfo) {
            this.groupInfoData = groupInfo;
        }
    }
}

// Export singleton instance for use in tests
const signalMock = new SignalCliRestApiMock();

module.exports = signalMock;
module.exports.SignalCliRestApiMock = SignalCliRestApiMock;

