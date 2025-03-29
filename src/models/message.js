
const { graphql } = require('../apis/graphql');
const webSocketManager = require('../apis/signal');

class Message {
    static async get(message_id) {
        const GET_MESSAGE = `
query GetMessage($id: ID!) {
    message(id: $id) {
        id
        text
        sender
        sent_time
        recipients
    }
}
        `;

        const result = await graphql(GET_MESSAGE, { id: message_id });
        return result.data.message;
    }

    static async create(sender, recipients, text, sent_time) {
        const CREATE_MESSAGE = `
mutation CreateMessage($text:String!, $sender:String!, $sent_time:timestamptz!, $recipients:[String!]!) {
    createMessage(text: $text, sender: $sender, sent_time: $sent_time, recipients: $recipients) {
        id
        text
        sender
        sent_time
        recipients
    }
}`;

        const message = {
            text,
            sender,
            sent_time,
            recipients
        };

        const result = await graphql(CREATE_MESSAGE,  message);
        this.id = result.data.createMessage.id;
        this.text = result.data.createMessage.text;
        this.sender = result.data.createMessage.sender;
        this.sent_time = result.data.createMessage.sent_time;
        this.recipients = result.data.createMessage.recipients;

        return result.data.createMessage;
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
