const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');
const Signal = require('../apis/signal');



export async function receive_message(sender, recipient, message, sent_time) {
    if (!message) {
        return;
    }
    const community = await Community.get(recipient);
    if (!community) {
        return;
    }
    let membership = await Membership.get(sender, recipient);
    if (!membership) {
        membership = await new_member(sender, community, message);
        await Message.create(community.id, membership.id, message, sent_time, true);
        return;
    }
    await Message.create(community.id, membership.id, message, sent_time, true);
    if (membership.step == 'done') {
        await no_script_message(membership);
        return;
    }
    const script = await Script.init(community.data.onboarding_id);
    await script.get_vars(membership, message);
    await script.receive(membership.step, message);
    return;
}

export async function new_member(phone, community, message) {
    const membership = await Membership.create(phone, community.id);
    await membership.set_variable('current_script_id', community.data.onboarding_id);
    const script = await Script.init(community.data.onboarding_id);
    await script.get_vars(membership, message);
    await script.send('0');
    return membership;
}

export async function no_script_message(user) {
    await Message.send(user.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
    return;
}

export async function script_message(member, message) {
    const script = await Script.init(member.current_script_id);
    await script.receive(member.step, message);
    return;
}

export async function receive_group_message(internal_group_id, message, from_phone, bot_phone, sender_name, sent_time) {
    const group_id = Buffer.from(internal_group_id).toString('base64');
    const membership = await Membership.get(from_phone, bot_phone);
    const community_id = membership.data.community.id;
    const group_thread = await GroupThread.find_or_create_group_thread(group_id, community_id);


    if (message && message.includes('#leave')) {
        GroupThread.leave_group(group_id, bot_phone);
        return;
    }
    if (group_thread.step !== 'done') {
        await GroupThread.run_script(group_thread, membership, message);
        return;
    }
    if (!message) { //If there is no message, return.
        return;
    }
    const hashtags = message.match(/#[\w]+/g);
    if (!hashtags) { //Ignore all messages without a hashtag
        return;
    }

    //Relay message to groups whose hashtags are listed
    const community_hashtags = group_thread.community.group_threads;
    if (!community_hashtags) {
        return;
    }
    for (const ht of community_hashtags) {
        if (hashtags.includes(ht.hashtag)) {
            const expanded_message = `Message relayed from ${from_phone}(${sender_name}) in ${group_thread.hashtag}: ${message}`;
            await Message.send(null, null, 'group.' + ht.group_id, bot_phone, expanded_message, false);
            await Signal.emoji_reaction(from_phone, bot_phone, sent_time, '✉️', group_thread.id );
        }
    }

    return;
}