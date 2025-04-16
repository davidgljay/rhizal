
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

    static async create(community_id, membership_id, text, signal_timestamp, from_user, about_membership_id = null) {
        const CREATE_MESSAGE = `
mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $signal_timestamp: bigint!, $about_membership_id: uuid = null) {
  insert_messages_one(
    object: {
        community_id: $community_id, 
        from_user: $from_user, 
        membership_id: $membership_id, 
        text: $text, 
        signal_timestamp: $signal_timestamp,
        about_membership_id: $about_membership_id
    }) 
    {
        id
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
            about_membership_id
        };
        const result = await graphql(CREATE_MESSAGE,  message);
        const { id, membership, community } = result.data.insert_messages_one;
        //TODO: Make this match graphql schema to match other objects, probably through a consistent constructor
        this.id = id;
        this.text = text;
        this.from_user = from_user;
        this.signal_timestamp = signal_timestamp;
        this.membership_id = membership_id;
        this.community_id = community_id;
        this.bot_phone = community.bot_phone;
        this.phone = membership.user.phone;

        return result.data.insert_messages_one;
    }

    static async send(community_id, membership_id, to_phone, from_phone, text, log_message = true, about_membership_id = null, message_type = "message", timeout = 1000) {
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
            if (log_message) {
                await Message.create(community_id, membership_id, text, timestamp, false, about_membership_id);
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

    static async send_to_admins(community_id, sender_id, text, community = null) {
        let bot_phone;
        let admins
        if (!community) {
        const SEND_TO_ADMINS = `
query SendToAdmins($community_id: uuid!) {
    communities(where: {id: {_eq: $community_id}}) {
        id
        bot_phone
        admins:memberships {
            id
            user {
                phone
            }
        }
    }
}`;

            const result = await graphql(SEND_TO_ADMINS, { community_id });
            const communityData = result.data.communities[0];
            if (!communityData) {
                console.error('CommunityData not found');
                return;
            }
            bot_phone = communityData.bot_phone;
            admins = communityData.admins;
        } else {
            bot_phone = community.bot_phone;
            admins = community.admins;
        }
        

        for (const admin of admins) {
            const { phone } = admin.user;
            await Message.send(
                community_id,
                admin.id, 
                phone, 
                bot_phone, 
                text, 
                true,
                sender_id, 
                "relay_to_admin", 
                0
            );
        }
    }


}

module.exports = Message;
