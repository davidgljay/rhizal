const WebSocket = require('ws');
const fetch = require('node-fetch');
const sqlite = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class WebSocketManager {
    constructor() {
        this.websockets = {};
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
        this.websockets[account_phone] = ws;
    }

    async trust_identity(recipient, from_number) {
        const trust_endpoint = `http://signal-cli:8080/v1/identities/${from_number}/trust/${recipient}`;
        return await fetch(trust_endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trust_all_known_keys: true })
        })
        .then(async response => {
            // Signal CLI returns 204 No Content on success, so check status before parsing JSON
            if (response.status === 204) {
                return { success: true };
            }
            if (!response.ok) {
                const text = await response.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    data = { error: text };
                }
                console.error('Error trusting identity:', response.statusText, data);
                return data;
            }
            // Try to parse JSON, but handle empty responses
            const text = await response.text();
            if (!text) {
                return { success: true };
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                return { success: true, raw: text };
            }
        })
        .catch(error => {
            console.error('Error trusting identity:', error);
            throw error;
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
        const response = await fetch(send_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        // If we get an untrusted identity error, trust all identities and retry
        if (data.error && (data.error.includes('untrusted identities') || data.error.includes('untrusted'))) {
            console.log('Untrusted identity detected, trusting identities and retrying...');
            // Trust identities for all recipients
            for (const recipient of recipients) {
                try {
                    await this.trust_identity(recipient, from_number);
                } catch (error) {
                    console.error(`Failed to trust identity for ${recipient}:`, error);
                }
            }
            // Retry sending
            const retryResponse = await fetch(send_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const retryData = await retryResponse.json();
            if (retryData.error) {
                console.error('Error sending message after trusting:', retryData.error);
            }
            this.clear_local_storage();
            return retryData;
        }
        
        if (!response.ok) {
            console.error('Error sending message:', response.statusText);
        }
        if (data.error) {
            console.error('Error in response:', data.error);
        }
        this.clear_local_storage();
        return data;
    }

    async leave_group(group_id, bot_number) {
        const leave_endpoint = `http://signal-cli:8080/v1/groups/${bot_number}/${group_id}/quit`;
        return await fetch(leave_endpoint, { method: 'POST' })
            .then(response => {
                if (!response.ok) {
                    console.error('Error leaving group:', response.statusText);
                    console.error('Response status:', response.status);
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

    async get_group_info(bot_phone, group_id) {
        const get_group_info_endpoint = `http://signal-cli:8080/v1/groups/${bot_phone}/group.${group_id}`;
        return await fetch(get_group_info_endpoint, { method: 'GET' })
            .then(response => {
                if (!response.ok) {
                    console.error('Error getting group info:', response.statusText);
                    console.error('Response status:', response.status);
                    return new Error('Error getting group info:', response.statusText);
                }
                return response.json();
            })
    }

    async get_contacts(bot_phone) {
        const get_contacts_endpoint = `http://signal-cli:8080/v1/contacts/${bot_phone}`;
        return await fetch(get_contacts_endpoint, { method: 'GET' })
            .then(async response => {
                if (!response.ok) {
                    console.error('Error getting member info:', response.statusText);
                }
                const response_data = await response.json();
                const contacts = response_data.reduce((hashmap, contact) => {
                    hashmap[contact.number] = contact.uuid;
                    return hashmap;
                }, {});
                return contacts;
            })
    }
}

const webSocketManager = new WebSocketManager();
module.exports = webSocketManager;