const ACCOUNT_PHONE = '1234567890';
process.env.ACCOUNT_PHONE = ACCOUNT_PHONE;
const webSocketManager = require('../apis/signal');
const WebSocket = require('ws');
const fetch = require('node-fetch');

jest.mock('ws');
jest.mock('node-fetch');

describe('WebSocketManager', () => {
    let mockWebSocketInstance;

    beforeEach(() => {

        mockWebSocketInstance = {
            on: jest.fn(),
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.OPEN,
        };
        WebSocket.mockImplementation(() => mockWebSocketInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
        WebSocket.mockReset();
        webSocketManager.ws = null;
    });

    it('should connect to WebSocket if not already connected', () => {
        const onReceive = jest.fn();
        webSocketManager.connect(onReceive);

        expect(WebSocket).toHaveBeenCalledWith(`ws://signal-cli:8080/v1/receive/${ACCOUNT_PHONE}`);
        expect(mockWebSocketInstance.on).toHaveBeenCalledWith('open', expect.any(Function));
        expect(mockWebSocketInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockWebSocketInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(mockWebSocketInstance.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should not connect to WebSocket if already connected', () => {
        const onReceive = jest.fn();
        webSocketManager.ws = {};

        webSocketManager.connect(onReceive);

        expect(WebSocket).not.toHaveBeenCalled();
    });

    it('should handle WebSocket message and call on_receive', () => {
        const onReceive = jest.fn();
        webSocketManager.connect(onReceive);
        
        expect(mockWebSocketInstance.on).toHaveBeenCalledWith('message', expect.any(Function));

        const messageHandler = mockWebSocketInstance.on.mock.calls.find(call => call[0] === 'message')[1];
        const messageData = JSON.stringify({ test: 'data' });

        messageHandler(messageData);

        expect(onReceive).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should handle WebSocket message parsing error', () => {
        const onReceive = jest.fn();
        webSocketManager.connect(onReceive);

        const messageHandler = mockWebSocketInstance.on.mock.calls.find(call => call[0] === 'message')[1];
        const invalidMessageData = 'invalid json';
        console.error = jest.fn();

        messageHandler(invalidMessageData);

        expect(console.error).toHaveBeenCalledWith('Error parsing WebSocket message:', expect.any(SyntaxError));
        expect(console.error).toHaveBeenCalledWith('WebSocket message:', invalidMessageData);
    });

    it('should send message if WebSocket is open', () => {
        const recipients = ['recipient1', 'recipient2'];
        const message = 'test message';
        const bot_phone = '+0987654321';
        webSocketManager.ws = mockWebSocketInstance;

        webSocketManager.send(recipients, bot_phone, message);

        expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({ recipients, from_number: bot_phone, message }));
    });

    it('should not send message if WebSocket is not open', () => {
        const recipients = ['recipient1', 'recipient2'];
        const message = 'test message';
        const bot_phone = '+0987654321';
        webSocketManager.ws = { readyState: WebSocket.CLOSED };
        console.error = jest.fn();

        webSocketManager.send(recipients, bot_phone, message);

        expect(console.error).toHaveBeenCalledWith('WebSocket is not open');
        expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });

    it('should not send message if recipients is not an array', () => {
        const recipients = 'recipient1';
        const message = 'test message';
        const bot_phone = '+0987654321';
        webSocketManager.ws = mockWebSocketInstance;
        console.error = jest.fn();

        webSocketManager.send(recipients, bot_phone, message);

        expect(console.error).toHaveBeenCalledWith('Recipients must be an array');
        expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });

    it('should leave group', async () => {
        const group_id = 'test_group_id';
        const bot_phone = '+0987654321';
        fetch.mockResolvedValue({ ok: true });

        await webSocketManager.leave_group(group_id, bot_phone);

        expect(fetch).toHaveBeenCalledWith(`https://signal-cli:8080/v1/groups/${bot_phone}/${group_id}/quit`, { method: 'POST' });
    });
});