const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');
const Signal = require('../apis/signal');
const { graphql } = require('../apis/graphql');
const { bot_message_hashtag } = require('../helpers/hashtag_commands');


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
    }
    users(where: {phone: {_eq: $phone}}) {
        id
        phone
    }
    memberships(where:{community:{bot_phone:{_eq: $bot_phone}},user:{phone:{_eq:$phone}}}) {
        id
        step
        name
        permissions
        informal_name
        current_script {
            id
            name
            script_json
            vars_query
            targets_query
        }
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
        bot_phone
        group_threads {
            group_id
            hashtag
        }
    }
    memberships(where:{community:{bot_phone:{_eq: $bot_phone}},user:{phone:{_eq:$phone}}}) {
    id
    step
    name
    permissions
    informal_name
    current_script {
        id
        name
        script_json
        vars_query
        targets_query
    }
    community {
        id
        bot_phone
    }
    user {
        id
        phone
    }
}`,
    replyQuery:
`query ReplyQuery($bot_phone:String!, $phone:String!, $signal_timestamp:bigint!) {
    memberships(where:{community:{bot_phone:{_eq: $bot_phone}},user:{phone:{_eq:$phone}}}) {
        id
        permissions
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
}`,

get_group_role_query: `
query GetGroupRole($group_id: String!) {
group_threads(where: {group_id: {_eq: $group_id}}) {
    id
    role
    community_id
}
}`

}


export async function receive_message(sender, recipient, message, sent_time, sender_name) {
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
        membership = await new_member(sender, community, message, user, sent_time);
        // await Message.create(community.id, membership.id, message, sent_time, true);
        return;
    }
    // Logging the metadata for incoming messages to enable reply handling.
    await Message.create(community.id, membership.id, '', sent_time, true);
    // Disabling ability to use hashtags in one-on-one conversations with the bot, you've gotta do 'em in a group.
    // if (message.match(/#[\w]+/)) {
    //     const hashtag = message.match(/#[\w]+/)[0];
    //     const command_triggered = await bot_message_hashtag(hashtag, membership, community, message);
    //     if (command_triggered) {
    //         return;
    //     }
    // }
    if (membership.step == 'done') {
        await no_script_message(membership, community, message);
        return;
    }
    let script = null;
    if (membership.current_script) {
        script = new Script(membership.current_script);
    } else {
        script = new Script(community.onboarding);
    }
    await script.get_vars(membership, message, sent_time);
    await script.receive(membership.step, message);
    return;
}

export async function receive_group_message(internal_group_id, message, from_phone, bot_phone, sender_name, sent_time) {
    const group_id = Buffer.from(internal_group_id).toString('base64');
    const response = await graphql(queries.receiveGroupMessageQuery, { bot_phone });
    const community = response.data.communities.length > 0 ? response.data.communities[0] : null;
    let membership = response.data.memberships.length > 0 ? response.data.memberships[0] : null;
    if (!community) {
        return;
    }
    const group_thread = await GroupThread.find_or_create_group_thread(group_id, community.id);


    if (message && message.includes('#leave')) {
        await GroupThread.leave_group(group_id, bot_phone);
        return;
    }

    //Check if the message includes a hashtag command, if so execute it.
    if (message && message.match(/#[\w]+/)) {
        const hashtag = message.match(/#[\w]+/)[0];
        const command_triggered = await bot_message_hashtag(hashtag, membership, community, message);
        if (command_triggered) {
            return;
        }
    }

    if (group_thread.step !== 'done') {
        await GroupThread.run_script(group_thread, {user: {phone: from_phone}, community}, message, sent_time);
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
    if (!community_hashtags || !membership.permissions.includes('group_comms')) {
        return;
    }
    for (const ht of community_hashtags) {
        if (hashtags.includes(ht.hashtag)) {
            const expanded_message = `Message relayed from ${sender_name} in ${group_thread.hashtag}: ${message}`;
            await Message.send(null, null, 'group.' + ht.group_id, bot_phone, expanded_message, false);
            await Signal.emoji_reaction(from_phone, bot_phone, sent_time, '📤', group_id );
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
        //TODO: Looks like we need to save messages in order to manage reply handling. Crap. So JUST timestamp and about_member? And it can presumably by purged eventually though that's tricky...
        // If no reply_to or membership is not an admin, return
        return;
    }
    if (!membership.permissions.includes('onboarding')) {
        // Treat as a normal message
        receive_message(from_phone, bot_phone, message, sent_time, sender_name);
        return;
    }
    const about_member_phone = response.data.messages[0].about_membership.user.phone;
    const expandedMessage = `Message from ${membership.name}: ${message}`;

    // Relay message to the member that the admin received a message about
    console.log('relaying message to', about_member_phone);
    await Message.send(membership.community_id, membership.id, about_member_phone, bot_phone, expandedMessage, false);
    
}

export async function group_join_or_leave(group_id, member_phone, bot_phone, join = false) {

    try {
        const result = await graphql(queries.get_group_role_query, { group_id });
        
        if (result.data.group_threads.length === 0) {
            return; // Group not found in our database
        }

        const group_thread = result.data.group_threads[0];
        
        if (group_thread.permissions) {
            
            // Update user's membership type to admin
            const membership = await Membership.get(member_phone, bot_phone);
            
            if (membership) {
                console.log('membership', membership);
                if (join) {
                    await Membership.add_permissions(membership.id, group_thread.permissions);
                }
                else {
                    await Membership.remove_permissions(membership.id, group_thread.permissions);
                }
            }
        }
    } catch (error) {
        console.error('Error handling member join:', error);
    }
}

export async function new_member(phone, community, message, user, sent_time) {
    const membership = await Membership.create(phone, community, user);
    const script = new Script(community.onboarding);
    await script.get_vars(membership, message, sent_time);
    await script.send('0');
    return membership;
}

export async function no_script_message(membership, community, message) {
    const relayMessage = `Message relayed from ${membership.name}: "${message}" Reply to respond.`;
    Message.send_to_onboarding(community.id, membership.id, relayMessage, community);
    return;
}
