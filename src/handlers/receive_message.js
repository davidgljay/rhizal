const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');
const Signal = require('../apis/signal');
const { graphql } = require('../apis/graphql');


const queries = {
    receiveMessageQuery: 
`query RecieveMessageQuery($bot_phone:String!, $phone:String!) {
    communities(where: {bot_phone: {_eq: $bot_phone}}) {
        id
        onboarding {
            id
            name
            script_json
            vars_query
            targets_query
        }
    }
    users(where: {phone: {_eq: $phone}}) {
        id
        phone
    }
    memberships(where:{community:{bot_phone:{_eq: $bot_phone}},user:{phone:{_eq:$phone}}}) {
        id
        step
        name
        informal_name
        community {
            id
            bot_phone
        }
        user {
            id
            phone
        }
    }
}`

}


export async function receive_message(sender, recipient, message, sent_time) {
    if (!message) {
        return;
    }
    const results = await graphql(queries.receiveMessageQuery, { bot_phone: recipient, phone: sender });
    const community = results.data.communities.length > 0 ? results.data.communities[0] : null;
    const user = results.data.users.length > 0 ? results.data.users[0] : null;
    let membership = results.data.memberships.length > 0 ? results.data.memberships[0] : null;
    if (!community) {
        return;
    }
    if (!membership) {
        membership = await new_member(sender, community, message, user);
        await Message.create(community.id, membership.id, message, sent_time, true);
        return;
    }
    await Message.create(community.id, membership.id, message, sent_time, true);
    if (membership.step == 'done') {
        await no_script_message(membership);
        return;
    }
    const script = new Script(community.onboarding);
    await script.get_vars(membership, message);
    await script.receive(membership.step, message);
    return;
}

export async function new_member(phone, community, message, user) {
    const membership = await Membership.create(phone, community, user);
    const script = new Script(community.onboarding);
    await script.get_vars(membership, message);
    await script.send('0');
    return membership;
}

export async function no_script_message(membership) {
    //community_id, membership_id, to_phone, from_phone, text, log_message = true
    await Message.send(membership.community.id, membership.id, membership.user.phone, membership.community.bot_phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.', true);
    return;
}

export async function receive_group_message(internal_group_id, message, from_phone, bot_phone, sender_name, sent_time) {
    const group_id = Buffer.from(internal_group_id).toString('base64');
    const membership = await Membership.get(from_phone, bot_phone);
    const community_id = membership.community.id;
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
            const expanded_message = `Message relayed from ${sender_name} in ${group_thread.hashtag}: ${message}`;
            await Message.send(null, null, 'group.' + ht.group_id, bot_phone, expanded_message, false);
            await Signal.emoji_reaction(from_phone, bot_phone, sent_time, '✉️', group_thread.id );
        }
    }

    return;
}