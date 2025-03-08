
const { graphql } = require('../apis/graphql');

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

    static async create(sender, text, sent_time, recipients) {
        const CREATE_MESSAGE = `
mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
        id
        text
        sender
        sent_time
        recipients
    }
}
        `;

        const message = {
            text,
            sender,
            sent_time,
            recipients
        };

        const result = await graphql(CREATE_MESSAGE, { input: message });
        this.id = result.data.createMessage.id;
        this.text = result.data.createMessage.text;
        this.sender = result.data.createMessage.sender;
        this.sent_time = result.data.createMessage.sent_time;
        this.recipients = result.data.createMessage.recipients;

        return result.data.createMessage;
    }

    static async send(phone, text, attachment) {
        //TODO: send a message via the signal API
    }

}

module.exports = Message;
