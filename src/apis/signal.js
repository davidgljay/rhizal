const WebSocket = require('ws');

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.account_phone = process.env.ACCOUNT_PHONE;
    }

    connect(on_receive) {
        if (this.ws) {
            console.log('WebSocket already connected');
            return;
        }

        console.log('Connecting to WebSocket for ' + this.account_phone + '... ');

        this.ws = new WebSocket('ws://signal-cli:8080/v1/receive/' + this.account_phone);

        this.ws.on('open', () => {
            console.log('WebSocket connection established');
        });

        this.ws.on('close', () => {
            console.log('WebSocket connection closed');
            this.ws = null;
        });

        this.ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });

        this.ws.on('message', (data) => {
            try {
                on_receive(JSON.parse(data));
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
                console.error('WebSocket message:', data);
            }
        });
    }

    send(recipients, message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not open');
            return;
        }
        if (!Array.isArray(recipients)) {
            console.error('Recipients must be an array');
            return;
        }
        this.ws.send(JSON.stringify({ recipients, message }));
    }
}

const webSocketManager = new WebSocketManager();
module.exports = webSocketManager;