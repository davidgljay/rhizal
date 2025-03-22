const { graphql } = require('../apis/graphql');

class GroupThreads {
    static async get_hashtag_group(signal_id, hashtag) {
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
        const hashtags = results.data.group_threads[0].community.group_threads;
        return hashtags.filter(ht => ht.hashtag === hashtag);
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

module.exports = GroupThreads;