
const { graphql } = require('../apis/graphql');
const Signal = require('../apis/signal');

class Message {

    static messageQueue = Promise.resolve();

    static async get(message_id) {
        const GET_MESSAGE = `
query GetMessage($id: ID!) {
    message(id: $id) {
        id
        text
        from_user
        sent_time
        membership {
            id
            user {
                phone
            }
        }
        community {
            id
            bot_phone
        }
    }
}
        `;

        const result = await graphql(GET_MESSAGE, { id: message_id });
        return result.data.message;
    }

    static async create(community_id, membership_id, text, signal_timestamp, from_user, about_membership_id = null, message_type = "message") {
        const CREATE_MESSAGE = `
mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $signal_timestamp: bigint!, $about_membership_id: uuid = null, $message_type: String = "message") {
  insert_messages_one(
    object: {
        community_id: $community_id, 
        from_user: $from_user, 
        membership_id: $membership_id, 
        text: $text, 
        signal_timestamp: $signal_timestamp,
        about_membership_id: $about_membership_id,
        type: $message_type
    }) 
    {
        id
        type
        membership {
            id
            user {
                phone
            }
        }
        community {
            id
            bot_phone
        }
    }
}`;

        const message = {
            community_id,
            from_user,
            membership_id,
            text,
            signal_timestamp,
            about_membership_id,
            message_type
        };
        const result = await graphql(CREATE_MESSAGE,  message);
        const { id, membership, community, type } = result.data.insert_messages_one;
        //TODO: Make this match graphql schema to match other objects, probably through a consistent constructor
        this.id = id;
        this.text = text;
        this.from_user = from_user;
        this.type = message_type;
        this.signal_timestamp = signal_timestamp;
        this.membership_id = membership_id;
        this.community_id = community_id;
        this.bot_phone = community.bot_phone;
        this.phone = membership.user.phone;

        return result.data.insert_messages_one;
    }

    static async send(community_id, membership_id, to_phone, from_phone, text, log_message = false, about_membership_id = null, message_type = "message", timeout = 1000) {
        // Add the message to the queue
        Message.messageQueue = Message.messageQueue.then(async () => {
            Signal.show_typing_indicator(to_phone, from_phone);
            if (process.env.NODE_ENV !== 'test') {
                await new Promise(resolve => setTimeout(resolve, timeout)); 
            }
            const {timestamp} = await Signal.send([to_phone], from_phone, text);
            if (!timestamp) {
                return;
            }
            if (message_type === 'save_message') {  
                await Message.create(community_id, membership_id, text, timestamp, false, about_membership_id, message_type);
            }
            if (log_message) {
                // Log the message metadata only for now.
                await Message.create(community_id, membership_id, '', timestamp, false, about_membership_id, message_type);
            }
        }).catch(err => {
            console.error('Error sending message:', err);
        });
        // Return the message queue promise
        return Message.messageQueue;
    }

    static async send_announcement(community_id, membership_id) {
        const ANNOUNCEMENT_QUERY = `
query AnnouncementQuery($community_id: uuid!, $membership_id: uuid!) {
    communities(where: {id: {_eq: $community_id}}) {
        id
        bot_phone
        memberships {
            id
            user {
                phone
            }
        }
        messages(where: 
            {
                type: {_eq: "draft_announcement"}, 
                membership_id: {_eq: $membership_id}}, 
                limit: 1, 
                order_by: {created_at: desc}) 
            {
            id
            text
        }
    }
}`;

        const result = await graphql(ANNOUNCEMENT_QUERY, { community_id, membership_id });
        const community = result.data.communities[0];
        if (!community) {
            console.error('Community not found');
            return;
        }
        if(!community.messages || community.messages.length === 0) {
            console.error('No announcement messages found');
            return;
        }
        const message = community.messages[0];
        const {bot_phone, memberships} = community;
        for (const membership of memberships) {
            const { phone } = membership.user;
            //TODO: Maybe refactor message.send to have a params object.
            await Message.send(
                community_id,
                membership.id, 
                phone, 
                bot_phone, 
                message.text, 
                true,
                null, 
                "announcement", 
                500
            );
        }
        
    }

    static async set_message_type(signal_timestamp, type) {
        const SET_MESSAGE_TYPE = `
mutation SetMessageType($signal_timestamp: bigint!, $type: String!) {
    update_messages(where: {signal_timestamp: {_eq: $signal_timestamp}}, _set: {type: $type}) {
        returning {
            id
        }
    }
}`
        const result = await graphql(SET_MESSAGE_TYPE, { signal_timestamp, type });
        return result.data.update_messages.returning[0];
    }

    static async send_to_permission(community_id, sender_id, text, permission = 'onboarding') {
        let bot_phone;
        let communityData;
        
        const SEND_TO_PERMISSION = `
query SendToPermission($community_id: uuid!, $permission: [String!]!) {
    communities(where: {id: {_eq: $community_id}}) {
        id
        bot_phone
        groups: group_threads(where: { permissions: { _contains: $permission } }) {
            id
            group_id
        }

    }
}`;

        const result = await graphql(SEND_TO_PERMISSION, { community_id, permission: [permission] });
        communityData = result.data.communities[0];
        if (!communityData) {
            throw new Error('Community not found');
        }
        if (communityData.groups.length === 0) {
            throw new Error(`No groups found with permission: ${permission}`);
        }
        bot_phone = communityData.bot_phone;


        for (const group of communityData.groups) {
            await Message.send(
                community_id,
                sender_id, //Use the about_message_id for group messages
                'group.' + group.group_id,
                bot_phone,
                text,
                true,
                sender_id,
                `relay_to_`+ permission + `_group`,
                0
            );
        }

    }

    static async send_permission_message(membership, permission) {
        const permissionMessages = {
            'announcement': 'Congrats, you have been granted announcement permission! You can now use #announcement to send a message to everyone registered with Rhizal. The hashtag will trigger a script which will walk you through the process of drafting and sending an announcement.',
            'group_comms': 'Congrats, you have been granted group comms permissions! You can now communicate between groups where the Rhizal bot is present by using hashtags. For example, if there is a #leaders group, you can send messages to it from another group by typing #leaders.',
            'onboarding': 'Congrats, you have been granted onboarding permissions! You should see messages from new members appearing in a group that you\'ve been invited to. You can reply to these messages to respond to people who are joining or who message the Rhizal bot with a question.'
        };
        
        const message = permissionMessages[permission];
        if (message) {
            await this.send(
                membership.community.id,
                membership.id,
                membership.user.phone,
                membership.community.bot_phone,
                message,
                false
            );
        }
      }


}

module.exports = Message;
