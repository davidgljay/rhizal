const { graphql } = require('../apis/graphql');

class GroupThread {
    static async get_hashtag_group(signal_id, hashtags) {
        const query = `
query getGroupThreads($signal_id: String!) {
    group_threads(where: {signal_id: {_eq: $signal_id}}) {
        community {
            group_threads {
                signal_id
                hashtag
            }
        }
    }
}`;

        const variables = { signal_id };
        const results = await graphql(query, variables);
        if  (results.data.group_threads.length === 0) {
            return [];
        }
        const group_threads = results.data.group_threads[0].community.group_threads;
        return group_threads.filter(ht => hashtags.includes(ht.hashtag));
    }

    static async send_message(message, from_phone, signal_id) {
        const payload = {
            message,
            signal_id,
        };
        if (process.env.NODE_ENV === 'test' || phone == process.env.ACCOUNT_PHONE) {
            await webSocketManager.send([signal_id], from_phone, message);
        }
    }
}

module.exports = GroupThread;