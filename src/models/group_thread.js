const { graphql } = require('../apis/graphql');
const Signal = require('../apis/signal');

class GroupThread {


    static async run_script(group_thread, membership, message, signal_timestamp) {
        const Script = require('./script');
        const script = await Script.init(group_thread.community.group_script_id);
        await script.get_vars(membership, message, signal_timestamp);
        script.vars.group_id = group_thread.group_id;
        if (group_thread.step == '0' && !message) {
            await script.send('0');
            return;
        } else if (message.match(/#[\w]+/) && membership.community.group_threads && membership.community.group_threads.map(ht => ht.hashtag).includes(message.match(/#[\w]+/)[0])) {
            await script.send('3');
            return;
        }
        else {
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
        permissions
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
    permissions
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

    static async create_group_and_invite(group_name, bot_phone, member_phone, permissions, community, make_admin = false) {
      const fetch = require('node-fetch');
      
      // Create Signal group via API
      const create_group_endpoint = `http://signal-cli:8080/v1/groups/${bot_phone}`;
      const group_data = {
          name: group_name,
          members: [member_phone, bot_phone],
          description: "Members of this group have admin access to the Rhizal bot for " + community.name,
          expiration_time: 0,
          group_link: "disabled",
          permissions: {
              add_members: "only-admins",
              edit_group: "only-admins",
              send_messages: "every-member"
            }
          };

        const response = await fetch(create_group_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(group_data)
        });

        if (!response.ok) {
            throw new Error(`Failed to create group: ${response.statusText}`);
        }

        const result = await response.json();
        const group_id = result.id.toString('base64');

        if (make_admin) {
          const make_admin_endpoint = `http://signal-cli:8080/v1/groups/${bot_phone}/${group_id}/admins`;
          const make_admin_data = {
            admins: [member_phone]
          };
          const make_admin_response = await fetch(make_admin_endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(make_admin_data)
          });
          if (!make_admin_response.ok) {
            throw new Error(`Failed to make admin: ${make_admin_response.statusText}`);
          }
        }
        // Store group in database with admin role
        const CREATE_ADMIN_GROUP_THREAD = `
mutation CreateAdminGroupThread($community_id: uuid!, $group_id: String!, $permissions: [String!]!) {
  insert_group_threads_one(object: {community_id: $community_id, group_id: $group_id, step: "done", permissions: $permissions}) {
	id
    group_id
    step
    hashtag
    permissions
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

          const create_result = await graphql(CREATE_ADMIN_GROUP_THREAD, {community_id: community.id, group_id, permissions});
          return create_result.data.insert_group_threads_one;
    }

}

module.exports = GroupThread;