const { graphql } = require('../apis/graphql');
const Signal = require('../apis/signal');

class GroupThread {


    static async run_script(group_thread, membership, message) {
        const Script = require('./script');
        const script = await Script.init(group_thread.community.group_script_id);
        await script.get_vars(membership, message);
        script.vars.group_id = group_thread.group_id;
        if (group_thread.step == '0' && !message) {
            await script.send('0');
            return;
        } else {
            await script.receive(group_thread.step, message);
        }
    }

    static async set_variable(group_id, variable, value) {
        const query = `
mutation UpdateGroupThreadVariable($group_id:String!, $value:String!) {
  update_group_threads(where: {group_id: {_eq: $group_id}}, _set: {${variable}: $value}) {
    returning {
      id
    }
  }
}`;

        const variables = { group_id, value };

        return await graphql(query, variables);
    }

    static async leave_group(group_id, bot_phone) {
        await Signal.leave_group(group_id, bot_phone);
    }

    static async find_or_create_group_thread(group_id, community_id) {
        const GET_GROUP_THREAD = `
query GetGroupThread($group_id: String!) {
    group_threads(where: {group_id: {_eq: $group_id}}) {
        id
        group_id
        step
        hashtag
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
  insert_group_threads_one(object: {community_id: $community_id, group_id: $group_id, step: "0"}) {
	id
    group_id
    step
    hashtag
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