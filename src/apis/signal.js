const WebSocket = require('ws');
const fetch = require('node-fetch');
const sqlite = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class WebSocketManager {
    constructor() {
    }

    connect(on_receive, account_phone) {

        console.log('Connecting to WebSocket for ' + account_phone + '... ');

        let ws = new WebSocket('ws://signal-cli:8080/v1/receive/' + account_phone);

        ws.on('open', () => {
            console.log('WebSocket connection established');
        });

        ws.on('close', () => {
            console.log('WebSocket connection closed');
            ws = null;
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });

        ws.on('message', (data) => {
            try {
                on_receive(JSON.parse(data));
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
                console.error('WebSocket message:', data);
            }
        });

        return ws;
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
        return await fetch(send_endpoint, {
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
            this.clear_local_storage();
            const data = response.json()
            if (data.error) {
                console.error('Error in response:', data.error);
            }
            return data;
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

    async emoji_reaction(to_phone, from_phone, message_timestamp, emoji, group_id) {
        const reaction_endpoint = `http://signal-cli:8080/v1/reactions/${from_phone}`;
        const body = {
            reaction: emoji,
            recipient: group_id ? 'group.' + group_id : to_phone,
            target_author: to_phone,
            timestamp: message_timestamp
        };
        await fetch(reaction_endpoint, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(response => {
            if (!response.ok) {
                console.error('Error sending emoji reaction:', response.statusText);
            }
            })
            .catch(error => {
            console.error('Error sending emoji reaction:', error);
            });
    }

    clear_local_storage() {
        //TODO: Confirm that this is the only place that messages are being stored in the local sqlite.
        const baseDir = '/home/.local/share/signal-cli/data';
        const directories = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.endsWith('.d'))
            .map(dirent => path.join(baseDir, dirent.name));

        for (const dir of directories) {
            const dbPath = path.join(dir, 'account.db');
            if (fs.existsSync(dbPath)) {
                const signal_db = sqlite(dbPath);
                try {
                    const stmt = signal_db.prepare('DELETE FROM message_send_log_content;');
                    stmt.run({ dbPath });
                } catch (error) {
                    if (error instanceof sqlite.SqliteError && error.code === 'SQLITE_ERROR') {
                        console.error(`Failed to execute query on ${dbPath}:`, error.message);
                    } else if (error instanceof Error) {
                        console.error(`Unexpected error while clearing local storage for ${dbPath}:`, error.message);
                    } else {
                        console.error(`Unknown error occurred for ${dbPath}:`, error);
                    }
                }
            }
        };
    };
}

const webSocketManager = new WebSocketManager();
module.exports = webSocketManager;