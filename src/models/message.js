
const { graphql } = require('../apis/graphql');
const webSocketManager = require('../apis/signal');

class Message {
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
            sent_time
        };

        const result = await graphql(CREATE_MESSAGE,  message);
        const { id, membership, community } = result.data.insert_messages_one;
        this.id = id;
        this.text = text;
        this.from_user = from_user;
        this.sent_time = sent_time;
        this.membership_id = membership.id;
        this.community_id = community.id;
        this.bot_phone = community.bot_phone;
        this.phone = membership.user.phone;

        return result.data.insert_messages_one;
    }

    static async send(to_phone, from_phone, text, log_message = true, attachment) {
        //Safety step to avoid sending messages to the wrong phone number
        if (log_message) {
            Message.create(from_phone, [to_phone], text,  Date.now());
        }

        if (process.env.NODE_ENV !== 'test') {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        webSocketManager.send([to_phone], from_phone, text);
    }

}

module.exports = Message;
