
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

    static async create(community_id, membership_id, text, sent_time, from_user) {
        const CREATE_MESSAGE = `
mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!) {
  insert_messages_one(object: {community_id: $community_id, from_user: $from_user, membership_id: $membership_id, text: $text, sent_time: $sent_time}) {
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
            sent_time: new Date(sent_time).toISOString()
        };
        const result = await graphql(CREATE_MESSAGE,  message);
        const { id, membership, community } = result.data.insert_messages_one;
        this.id = id;
        this.text = text;
        this.from_user = from_user;
        this.sent_time = sent_time;
        this.membership_id = membership_id;
        this.community_id = community_id;
        this.bot_phone = community.bot_phone;
        this.phone = membership.user.phone;

        return result.data.insert_messages_one;
    }

    static async send(community_id, membership_id, to_phone, from_phone, text, log_message = true, attachment) {
        // Add the message to the queue
        Message.messageQueue = Message.messageQueue.then(async () => {
            // Safety step to avoid sending messages to the wrong phone number
            if (log_message) {
                await Message.create(community_id, membership_id, text, Date.now(), false);
            }

            if (process.env.NODE_ENV !== 'test') {
                await new Promise(resolve => setTimeout(resolve, 2000)); 
            }
            Signal.send([to_phone], from_phone, text);
        }).catch(err => {
            console.error('Error sending message:', err);
        });
        // Return the message queue promise
        return Message.messageQueue;
    }

}

module.exports = Message;
