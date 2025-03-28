const { graphql } = require('../apis/graphql');
const Membership = require('./membership');
const Script = require('./script');
const webSocketManager = require('../apis/signal');

class GroupThread {

    static async send_message(message, from_phone, group_id) {
        if (process.env.NODE_ENV === 'test' || phone == process.env.ACCOUNT_PHONE) {
            await webSocketManager.send([group_id], from_phone, message);
        }
    }

    static async recieve_group_message(group_id, message, from_phone, bot_phone, sender_name) {

    }

    static async run_script(group_thread, membership, message) {
        const script = await Script.init(group_thread.community.group_script_id);
        await script.get_vars(membership, message);
        if (group_thread.step == '0') {
            await script.send('0');
            return;
        } else {
            await script.receive(group_thread.step, message);
        }
    }

    static async update_group_thread_variable(group_thread_id, variable, value) {
        const query = `
mutation UpdateGroupThreadVariable($group_thread_id: uuid!, $variable: String!, $value: String!) {
    update_group_threads_by_pk(pk_columns: $group_thread_id, _set: {[$variable]: $value}) {
        id
    }`;

        const variables = { group_thread_id, variable, value };

        return await graphql(query, variables);
    }

    static async send_message(message, from_phone, group_id) {
        const payload = {
            message,
            group_id,
        };
        if (process.env.NODE_ENV === 'test' || phone == process.env.ACCOUNT_PHONE) {

            webSocketManager.send([group_id], from_phone, message);
        }
    }

    static async leave_group(group_id, bot_phone) {
        console.log('Leaving group', group_id);
        await webSocketManager.leave_group(group_id, bot_phone);
    }

    static async find_or_create_group_thread(group_id, community_id) {
        const GET_GROUP_THREAD = `
query GetGroupThread($group_id: String!) {
    group_threads(where: {group_id: {_eq: $group_id}}) {
        id
        group_id
        step
        community {
            id
            group_script_id
            group_threads {
                group_id
                hashtag
            }
        }
    }
}`;

        const CREATE_GROUP_THREAD = `
mutation CreateGroupThread($community_id: uuid!, $group_id: String!) {
  insert_group_threads_one(object: {community_id: $community_id, group_id: $group_id, step: 0}) {
	id
    group_id
    step
    community {
      group_script_id
      group_threads {
        group_id
        hashtag
      }
    }
  }
}
`;
        const get_result = await graphql(GET_GROUP_THREAD, {group_id});
        if (get_result.data.group_threads.length > 0) {
            return get_result.data.group_threads[0];
        }
        const create_result = await graphql(CREATE_GROUP_THREAD, {community_id, group_id});
        return create_result.data.insert_group_threads_one;
    }
}

module.exports = GroupThread;