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

   describe('send', () => {
    it('should send message using fetch if recipients is an array', async () => {
        const recipients = ['recipient1', 'recipient2'];
        const message = 'test message';
        const bot_phone = '+0987654321';
        const mockResponse = { ok: true };
        fetch.mockResolvedValue(mockResponse);
    
        await webSocketManager.send(recipients, bot_phone, message);
    
        expect(fetch).toHaveBeenCalledWith('http://signal-cli:8080/v2/send/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipients,
                number: bot_phone,
                message,
            }),
        });
    });
    
    it('should log an error if fetch fails while sending message', async () => {
        const recipients = ['recipient1', 'recipient2'];
        const message = 'test message';
        const bot_phone = '+0987654321';
        const errorMessage = 'Network error';
        fetch.mockRejectedValue(new Error(errorMessage));
        console.error = jest.fn();
    
        await webSocketManager.send(recipients, bot_phone, message);
    
        expect(console.error).toHaveBeenCalledWith('Error sending message:', expect.any(Error));
    });
    
    it('should log an error if fetch response is not ok', async () => {
        const recipients = ['recipient1', 'recipient2'];
        const message = 'test message';
        const bot_phone = '+0987654321';
        const mockResponse = { ok: false, statusText: 'Bad Request' };
        fetch.mockResolvedValue(mockResponse);
        console.error = jest.fn();
    
        await webSocketManager.send(recipients, bot_phone, message);
    
        expect(console.error).toHaveBeenCalledWith('Error sending message:', 'Bad Request');
    });
});

    describe('leaving group', () => {
        it('should leave group using fetch', async () => {
            const group_id = 'test_group_id';
            const bot_phone = '+0987654321';
            const mockResponse = { ok: true };
            fetch.mockResolvedValue(mockResponse);

            await webSocketManager.leave_group(group_id, bot_phone);

            expect(fetch).toHaveBeenCalledWith(`https://signal-cli:8080/v1/groups/${bot_phone}/${group_id}/quit`, { method: 'POST' });
        });

        it('should log an error if fetch fails while leaving group', async () => {
            const group_id = 'test_group_id';
            const bot_phone = '+0987654321';
            const errorMessage = 'Network error';
            fetch.mockRejectedValue(new Error(errorMessage));
            console.error = jest.fn();

            await webSocketManager.leave_group(group_id, bot_phone);

            expect(console.error).toHaveBeenCalledWith('Error leaving group:', expect.any(Error));
        });

        it('should log an error if fetch response is not ok while leaving group', async () => {
            const group_id = 'test_group_id';
            const bot_phone = '+0987654321';
            const mockResponse = { ok: false, statusText: 'Bad Request' };
            fetch.mockResolvedValue(mockResponse);
            console.error = jest.fn();

            await webSocketManager.leave_group(group_id, bot_phone);

            expect(console.error).toHaveBeenCalledWith('Error leaving group:', 'Bad Request');
        });
    });

    describe('show typing indicator', () => {
        it('should send typing indicator using fetch', async () => {
            const number = 'test_number';
            const to_phone = '+0987654321';
            const mockResponse = { ok: true };
            fetch.mockResolvedValue(mockResponse);

            await webSocketManager.show_typing_indicator(number, to_phone);

            expect(fetch).toHaveBeenCalledWith(`http://signal-cli:8080/v1/typing-indicator/${number}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recipient: to_phone }),
            });
        });

        it('should log an error if fetch fails while sending typing indicator', async () => {
            const number = 'test_number';
            const to_phone = '+0987654321';
            const errorMessage = 'Network error';
            fetch.mockRejectedValue(new Error(errorMessage));
            console.error = jest.fn();

            await webSocketManager.show_typing_indicator(number, to_phone);

            expect(console.error).toHaveBeenCalledWith('Error sending typing indicator:', expect.any(Error));
        });

        it('should log an error if fetch response is not ok while sending typing indicator', async () => {
            const number = 'test_number';
            const to_phone = '+0987654321';
            const mockResponse = { ok: false, statusText: 'Bad Request' };
            fetch.mockResolvedValue(mockResponse);
            console.error = jest.fn();

            await webSocketManager.show_typing_indicator(number, to_phone);

            expect(console.error).toHaveBeenCalledWith('Error sending typing indicator:', 'Bad Request');
        });
    });
});
