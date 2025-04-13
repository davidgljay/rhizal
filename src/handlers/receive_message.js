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
        bot_phone
        onboarding {
            id
            name
            script_json
            vars_query
            targets_query
        }
        admins: memberships(where: {type: {_eq: "admin"}}) {
            id
            user {
                phone
            }
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
}`,
    receiveGroupMessageQuery:
`query RecieveGroupMessageQuery($bot_phone:String!) {
    communities(where: {bot_phone: {_eq: $bot_phone}}) {
        id
        group_script_id
        group_threads {
            group_id
            hashtag
        }
    }
}`,
    replyQuery:
`query ReplyQuery($bot_phone:String!, $phone:String!, $signal_timestamp:bigint!) {
    memberships(where:{community:{bot_phone:{_eq: $bot_phone}},user:{phone:{_eq:$phone}}}) {
        id
        type
        name
        community_id
    }
    messages(where: {signal_timestamp: {_eq: $signal_timestamp}, community:{bot_phone:{_eq: $bot_phone}}}) {
        id
        about_membership {
            id
            user {
                phone
            }
        }
    }
}`


}


export async function receive_message(sender, recipient, message, sent_time, sender_name) {
    if (!message) {
        return;
    }
    const results = await graphql(queries.receiveMessageQuery, { bot_phone: recipient, phone: sender });
    console.log(results)
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
        await no_script_message(membership, community, message);
        return;
    }
    const script = new Script(community.onboarding);
    await script.get_vars(membership, message);
    await script.receive(membership.step, message);
    return;
}

export async function receive_group_message(internal_group_id, message, from_phone, bot_phone, sender_name, sent_time) {
    const group_id = Buffer.from(internal_group_id).toString('base64');
    const response = await graphql(queries.receiveGroupMessageQuery, { bot_phone });
    const community = response.data.communities.length > 0 ? response.data.communities[0] : null;
    if (!community) {
        return;
    }
    const group_thread = await GroupThread.find_or_create_group_thread(group_id, community.id);


    if (message && message.includes('#leave')) {
        await GroupThread.leave_group(group_id, bot_phone);
        return;
    }
    if (group_thread.step !== 'done') {
        await GroupThread.run_script(group_thread, {user: {phone: from_phone}, community}, message);
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

export async function receive_reply(message, from_phone, bot_phone, reply_to_timestamp, sent_time, sender_name) {

    // Get replyQuery from GraphQL
    const response = await graphql(queries.replyQuery, { phone: from_phone, bot_phone, signal_timestamp: reply_to_timestamp });
    const membership = response.data.memberships.length > 0 ? response.data.memberships[0] : null;
    const reply_to = response.data.messages.length > 0 && response.data.messages[0].about_membership ? response.data.messages[0].about_membership.user.phone : null;
    if (!reply_to || !membership) {
        // If no reply_to or membership is not an admin, return
        return;
    }
    if (membership.type !== 'admin') {
        // Treat as a normal message
        receive_message(from_phone, bot_phone, message, sent_time, sender_name);
        return;
    }
    const about_member_phone = response.data.messages[0].about_membership.user.phone;
    const expandedMessage = `Message from ${membership.name}: ${message}`;

    // Relay message to the member that the admin received a message about
    await Message.send(membership.community_id, membership.id, about_member_phone, bot_phone, expandedMessage, true);
    
}

export async function new_member(phone, community, message, user) {
    const membership = await Membership.create(phone, community, user);
    const script = new Script(community.onboarding);
    await script.get_vars(membership, message);
    await script.send('0');
    return membership;
}

export async function no_script_message(membership, community, message) {
    await Message.send(membership.community.id, membership.id, membership.user.phone, membership.community.bot_phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.', true);
    relay_message_to_admins(community, message, membership.name, membership.id);
    return;
}

export async function relay_message_to_admins(community, message, sender_name, sender_id) {
    const admins = community.admins;
    if (!admins) {
        return;
    }
    for (const admin of admins) {
        const expandedMessage = `Message relayed from ${sender_name}: "${message}" Reply to respond.`;
        await Message.send(community.id, admin.id, admin.user.phone, community.bot_phone, expandedMessage, true, sender_id);
    }
    return;
} 

export async function send_announcement(community, message) {
    /*
    * Simple version of sending an announcement for now. 
    * If an admin messages a bot with #announcement it will trigger a script which asks for an announcement, confirms, and then sends. 
    * This will be improved in the future to allow for more complex announcements, such as ones that target specific members or are sent in the future.
    * 
    * 1. #announcement triggers a script if member is an admin. How do I handle system-level scripts? Create a community called "system"?
    * 2. Script asks for announcement text. How is this saved?
    *     a. I have an "announcements" concept, I'll need a save_announcement function in the parser. Or is this overkill for now? Maybe I just have a type field, and a message can be type "announcement". 
    * 3. Script asks for confirmation, loads announcement text, and sends it to all members of the community.
    *     a. Announcement text is most recent message from the admin with type "announcement". 
    * 
    */
}