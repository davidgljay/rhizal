
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
mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
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

        const result = await graphql({query: CREATE_MESSAGE,  variables: message });
        this.id = result.data.createMessage.id;
        this.text = result.data.createMessage.text;
        this.sender = result.data.createMessage.sender;
        this.sent_time = result.data.createMessage.sent_time;
        this.recipients = result.data.createMessage.recipients;

        return result.data.createMessage;
    }

    static async send(phone, text, attachment) {
        //Safety step to avoid sending messages to the wrong phone number
        if (process.env.NODE_ENV === 'test' || phone == process.env.ACCOUNT_PHONE) {
            webSocketManager.send([phone], text);
        }
    }

}

module.exports = Message;
