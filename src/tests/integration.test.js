const { receive_message } = require('../handlers/receive_message');
const signal = require('../apis/signal');
const {graphql} = require('../apis/graphql');
const User = require('../models/user');
const Message = require('../models/message');

const testScript = `
0:
    send:
        - Message with {{var1}} to {{var2}}!
    on_receive:
        if: regex(var1, /foo/)
        then:
            - user_status: 1
            - set_variable:
                variable: name
                value: user_name
        else:
            - user_status: done
1:
    send:
        - Another message with no variables!
        - A second message to be sent a few seconds later.
        - attach(filevar)
    on_receive:
        user_status: done
`

jest.mock('../apis/signal', () => ({
    send: jest.fn()
}));
jest.mock('../apis/graphql', () => ({
    graphql: jest.fn()
}));
jest.spyOn(User, 'get');
jest.spyOn(User, 'create');
jest.spyOn(User, 'set_variable');

jest.spyOn(Message, 'send');
jest.spyOn(Message, 'create');

describe('Integration Tests for receive_message Handler', () => {

    beforeEach(() => {
 
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create a new user and send the first message of the script for a new phone number', async () => {
        const senderNumber = '+1234567890';
        const recipientNumbers = ['+0987654321'];
        const sentTime = 1741644982;
        const firstMessage = 'Welcome to the service!';
            graphql.mockResolvedValueOnce(
                { data: { createMessage: {id: 1} } } 
            )
            .mockResolvedValueOnce(
                { data: { GetScript: { script: {id: 2, name: 'onboarding', yaml: testScript, varsquery: 'testVarsQuer {}'} } } }
            )
            .mockResolvedValueOnce(
                { data: { GetUser: { user: {id: 1} } } }
            );
        User.get.mockResolvedValue(null);
        User.create.mockResolvedValue({ id: 1, senderNumber });

        await receive_message(senderNumber, recipientNumbers, 'Hello', sentTime);

        expect(Message.create).toHaveBeenCalledWith(
            senderNumber,
            recipientNumbers,
            'Hello',
            sentTime
        );
        expect(graphql).toHaveBeenCalledTimes(3);
        expect(graphql.mock.calls[0]).toEqual([
            {
            query: `
mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
        id
        text
        sender
        sent_time
        recipients
    }
}`,
            variables: {
                    recipients: ['+0987654321'],
                    sender: '+1234567890',
                    sent_time: 1741644982,
                    text: 'Hello'
                }
            }
        ]);
        expect(User.create).toHaveBeenCalledTimes(1);
        expect(signal.send).toHaveBeenCalledWith(senderNumber, 'Message with {{var1}} to {{var2}}!');
    });

    xit('should send the next message in the script for an existing user', async () => {
        const phoneNumber = '+1234567890';
        const nextMessage = 'This is the next message in the script.';
        const user = { id: 1, phoneNumber, scriptProgress: 1 };

        getUserMock.mockResolvedValue(user);
        updateUserMock.mockResolvedValue({ ...user, scriptProgress: 2 });
        getScriptMessageMock.mockResolvedValue(nextMessage);

        await receiveMessageHandler({ phoneNumber, message: 'Next' });

        expect(updateUserMock).toHaveBeenCalledTimes(1);
        expect(signalApiMock).toHaveBeenCalledWith(phoneNumber, nextMessage);
        expect(graphqlApiMock).toHaveBeenCalledWith(phoneNumber, nextMessage);
    });
});
