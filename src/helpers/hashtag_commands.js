import Membership from "../models/membership";
import GroupThread from "../models/group_thread";
import Script from "../models/script";

export async function bot_message_hashtag(hashtag, membership, community, message, group_thread) {
    const announcement_script = await Script.get_system_script('announcement');

    switch(hashtag) {
        case '#announcement':
            if (!membership.permissions.includes('announcement')) {
                return false;
            }
            if (!announcement_script) {
                return;
            }
            await Membership.set_variable(membership.id, 'current_script_id', announcement_script.id);
            await Membership.set_variable(membership.id, 'step', '0');
            await announcement_script.get_vars(membership, message);
            await announcement_script.send('0');
            return true;
        case '#cancel':
            if (!announcement_script) {
                return false;
            }
            await announcement_script.get_vars(membership, message);
            await announcement_script.send('3');
            await Membership.set_variable(membership.id, 'step', 'done');
            return true;
        case '#name':
            const group_name_script = await Script.get('group_thread');
            if (!membership.permissions.includes('group_comms')) {
                return false;
            }
            await GroupThread.set_variable(group_thread.id, 'step', '0');
            await group_name_script.get_vars(membership, message);
            group_name_script.vars.group_id = group_thread.group_id;
            await group_name_script.send('0');
            return true;
    }
    return false;
};


export async function group_message_hashtag(hashtag, bot_phone, group_id, message) {
};