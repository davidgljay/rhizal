const WebSocket = require('ws');
const fetch = require('node-fetch');

class WebSocketManager {
    constructor() {
        this.ws = null;
        //TODO: Handle multiple accounts
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

    async send(recipients, from_number, message) {
        if (!Array.isArray(recipients)) {
            console.error('Recipients must be an array');
            return;
        }
        const send_endpoint = `http://signal-cli:8080/v2/send/`;
        const body = {
            recipients,
            number: from_number,
            message
        };
        await fetch(send_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(response => {
                if (!response.ok) {
                    console.error('Error sending message:', response.statusText);
                }
            })
            .catch(error => {
                console.error('Error sending message:', error);
            });
    }

    async leave_group(group_id, bot_number) {
        const leave_endpoint = `https://signal-cli:8080/v1/groups/${bot_number}/${group_id}/quit`;
        return await fetch(leave_endpoint, { method: 'POST' })
            .then(response => {
                if (!response.ok) {
                    console.error('Error leaving group:', response.statusText);
                }
            })
            .catch(error => {
                console.error('Error leaving group:', error);
            });
    }

    async show_typing_indicator(to_phone, from_phone) {
        const typing_endpoint = `http://signal-cli:8080/v1/typing-indicator/${from_phone}`;
        const body = {
            recipient: to_phone
        };
        await fetch(typing_endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(response => {
                if (!response.ok) {
                    console.error('Error sending typing indicator:', response.statusText);
                }
            })
            .catch(error => {
                console.error('Error sending typing indicator:', error);
            });
    }
}

const webSocketManager = new WebSocketManager();
module.exports = webSocketManager;