import Membership from "../models/membership";
import Script from "../models/script";

export async function bot_message_hashtag(hashtag, membership, community, message) {
    switch(hashtag) {
        case '#announcement':
            // Get system script for announcement
            const announcement_script = await Script.get_system_script('announcement');
            if (!announcement_script) {
                return;
            }
            await Membership.set_variable(membership.id, 'current_script_id', announcement_script.id);
            await Membership.set_variable(membership.id, 'step', '0');
            await announcement_script.get_vars(membership, message);
            await announcement_script.send('0');
            break;
    }
};


export async function group_message_hashtag(hashtag, bot_phone, group_id, message) {
};