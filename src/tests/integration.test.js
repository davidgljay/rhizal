const { receive_message } = require('../handlers/receive_message');
const signal = require('../apis/signal');
const {graphql} = require('../apis/graphql');
const Membership = require('../models/membership');
const Message = require('../models/message');
const Community = require('../models/community');

const testScript = `
0: 
    send:
        - Welcome to the service!
    on_receive:
        step: 1
1:
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
            - step: done
2:
    send:
        - Another message with no variables!
        - A second message to be sent a few seconds later.
        - attach(filevar)
    on_receive:
        step: done
`

jest.mock('../apis/signal', () => ({
    send: jest.fn()
}));
jest.mock('../apis/graphql', () => ({
    graphql: jest.fn()
}));
jest.spyOn(Membership, 'get');
jest.spyOn(Membership, 'create');
jest.spyOn(Community, 'get');

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
        // Graphql should expect the following calls in the following order:
        // 1. Create message
        // 2. Get community
        // 3. Get membership
        // 4. Get user
        // 5. Create membership or create membership and user
        // 7. Update membership current_script_id
        // 8. Get script
        // 9. Send first message of script
        // 10. Update membership step

        const mockGraphql = [
            {
                query: `mutation CreateMessage($text:String!, $sender:String!, $sent_time:timestamptz!, $recipients:[String!]!)`,
                variables: {
                    recipients: recipientNumbers,
                    sender: senderNumber,
                    sent_time: sentTime,
                    text: 'Hello'
                },
                response: { data: { createMessage: { id: "1" } } }
            },
            {
                query: `query GetCommunities($bot_phone:String!)`,
                variables: { bot_phone: recipientNumbers[0] },
                response: { data: { communities: [{ id: "1", name: 'Mock Community', onboarding_id: '2' }] } }
            },
            {
                query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                variables: { phone: senderNumber, bot_phone: recipientNumbers[0] },
                response: { data: { memberships: [] } }
            },
            {
                query: `query GetUser($phone: String!)`,
                variables: { phone: senderNumber },
                response: { data: { users: [] } }
            },
            {
                query: `mutation CreateUserAndMembership($phone:String!, $community_id:uuid!)`,
                variables: { phone: senderNumber, community_id: "1" },
                response: { data: { insert_memberships_one: { id: "1", user: { id: "1", phone: senderNumber }, type: 'member', community: { bot_phone: recipientNumbers[0] } } } }
            },
            {
                query: `mutation updateMembershipVariable($id:uuid!, $value:uuid!)`,
                variables: { id: "1", current_script_id: "2" },
                response: { data: { updateMembership: { id: "1" } } }
            },
            {
                query: `query GetScript($id:uuid!)`,
                variables: { id: "2" },
                response: { data: { script: { id: "2", name: 'onboarding', yaml: testScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } } }
            },
            {
                query: `query testVarsQuery($membership_id:uuid!)`,
                variables: { membership_id: "1" },
                response: { data: { vars: [{ name: 'var1' }] } }
            },
            {
                query: `mutation CreateMessage($text:String!, $sender:String!, $sent_time:timestamptz!, $recipients:[String!]!)`,
                variables: {
                    recipients: [senderNumber],
                    sender: recipientNumbers[0],
                    sent_time: expect.any(Number),
                    text: 'Welcome to the service!'
                },
                response: { data: { createMessage: { id: "2" } } }
            }
        ];

        for (let i = 0; i < mockGraphql.length; i++) {
            graphql.mockImplementationOnce((...args) => {
                // console.log('graphql called with:', args);
                return Promise.resolve(mockGraphql[i].response);
            });
            
        }

        await receive_message(senderNumber, recipientNumbers, 'Hello', sentTime);

        expect(Message.create).toHaveBeenCalledWith(
            senderNumber,
            recipientNumbers,
            'Hello',
            sentTime
        );
        for (let i = 0; i < mockGraphql.length; i++) {
            expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
        }
        expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);

        expect(Message.create).toHaveBeenCalledTimes(2);
        expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumbers[0], 'Welcome to the service!');
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
