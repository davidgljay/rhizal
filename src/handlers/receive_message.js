const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');



export async function receive_message(sender, recipients, message, sent_time) {
    //TODO: Refactor from recipient to recipients
    if (!message) {
        return;
    }
    await Message.create(sender, recipients, message, sent_time);
    const community = await Community.get(recipients[0]);
    if (!community) {
        return;
    }
    let membership = await Membership.get(sender, recipients[0]);
    if (!membership) {
        membership = await new_member(sender, community, message);
        return;
    }
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

export async function receive_group_message(internal_group_id, message, from_phone, bot_phone, sender_name) {
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
            await GroupThread.send_message(expanded_message, bot_phone, ht.group_id);
        }
    }
    // Thanks for inviting me to join! This is the Rhizal script. I'll completely ignore everything said in this group unless it contains a hashtag.
    // If it does I'll route it to another group, then forget it.
    // For example, writing a message with #leadership would route to the leadership group.
    // To get you set up, what hashtag should others use to message this group? (e.g. #coolkids)
    // You can always change this in the future by writing #name.
    //
    // Got it! I'll route messages with #hashtag to this group.
    // 
    // Hmm, it looks like that hashtag is already taken. Could you please choose another one?
    //

    //[{"envelope":{"source":"00fa3971-e783-4399-956b-8786549e32ff","sourceNumber":null,"sourceUuid":"00fa3971-e783-4399-956b-8786549e32ff","sourceName":"DJ","sourceDevice":1,"timestamp":1742794738464,"serverReceivedTimestamp":1742794738571,"serverDeliveredTimestamp":1742794752235,"dataMessage":{"timestamp":1742794738464,"message":null,"expiresInSeconds":0,"viewOnce":false,"groupInfo":{"groupId":"fPNM9lou0GB1fThpagjDTfJl6GaTd2LqDoGZ7e8vO5I=","type":"DELIVER"}}},"account":"+14155551212"}]
    return;
}