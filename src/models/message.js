
const { graphql } = require('../apis/graphql');

class Message {
    async get(message_id) {
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
        this.id = result.data.message.id;
        this.text = result.data.message.text;
        this.sender = result.data.message.sender;
        this.sent_time = result.data.message.sent_time;
        this.recipients = result.data.message.recipients;
        return result.data.message;
    }

    async create(sender, text, sent_time, recipients) {
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
}

module.exports = Message;
