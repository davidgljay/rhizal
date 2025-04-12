
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
        membership: author {
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

    static async send(community_id, membership_id, to_phone, from_phone, text, log_message = true, about_membership_id = null) {
        // Add the message to the queue
        Message.messageQueue = Message.messageQueue.then(async () => {
            Signal.show_typing_indicator(to_phone, from_phone);
            if (process.env.NODE_ENV !== 'test') {
                await new Promise(resolve => setTimeout(resolve, 2000)); 
            }
            const {timestamp} = await Signal.send([to_phone], from_phone, text);
            if (log_message) {
                await Message.create(community_id, membership_id, text, timestamp, false, about_membership_id);
            }
        }).catch(err => {
            console.error('Error sending message:', err);
        });
        // Return the message queue promise
        return Message.messageQueue;
    }

}

module.exports = Message;
