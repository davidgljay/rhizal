const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');


export async function receive_message(sender, recipients, message, sent_time) {
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
        membership = await new_member(sender, community);
        return;
    }
    if (membership.step == 'done') {
        await no_script_message(membership);
        return;
    }
    const script = await Script.init(community.data.onboarding_id);
    await script.get_vars(membership);
    await script.receive(membership.step, message);
    return;
}

export async function new_member(phone, community) {
    const membership = await Membership.create(phone, community.id);
    await membership.set_variable('current_script_id', community.data.onboarding_id);
    const script = await Script.init(community.data.onboarding_id);
    await script.get_vars(membership);
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