const { graphql } = require('../apis/graphql');
const Signal = require('../apis/signal');

class GroupThread {


    static async run_script(group_thread, membership, message, signal_timestamp) {
        const Script = require('./script');
        if (!group_thread.community.group_script_id) {
            console.error(`No group_script_id found for group_thread ${group_thread.id}`);
            return;
        }
        const script = await Script.init(group_thread.community.group_script_id);
        await script.get_vars(membership, message || '', signal_timestamp);
        script.vars.group_id = group_thread.group_id;
        // Include hashtag in vars if it exists (for use in step 1 message)
        if (group_thread.hashtag) {
            script.vars.hashtag = group_thread.hashtag;
        }
        
        console.log(`Running group_thread script. Step: ${group_thread.step}, Has message: ${!!message}, Message: ${message}`);
        
        // If step is '0', send the initial welcome message and then process the message
        // Only send welcome messages if there's actually a message to process
        if (group_thread.step == '0') {
            if (!message) {
                console.log('Step is 0 but no message provided - skipping script execution.');
                return;
            }
            console.log('Step is 0 - sending welcome messages, then processing message.');
            await script.send('0');
            // Process the message after sending welcome messages
            console.log(`Processing message "${message}" after sending welcome messages to advance step.`);
            // Ensure message is in vars for processing
            script.vars.message = message;
            await script.receive('0', message);
            console.log('Message processed, step should have advanced.');
            return;
        }
        // Check if message contains a hashtag that's already taken (only check during setup, not if group_thread already has a hashtag)
        // This check should only happen when the group_thread doesn't have a hashtag yet (steps 0, 1, 2)
        if (!group_thread.hashtag && message && message.match(/#[\w]+/) && membership.community.group_threads && membership.community.group_threads.map(ht => ht.hashtag).includes(message.match(/#[\w]+/)[0])) {
            console.log('Hashtag already taken, sending step 3');
            await script.send('3');
            return;
        }
        // Otherwise, process the message normally
        console.log(`Processing message in step ${group_thread.step}`);
        await script.receive(group_thread.step, message || '');
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
            console.log(`Found existing group_thread for group_id: ${group_id}`);
            return get_result.data.group_threads[0];
        }
        console.log(`Creating new group_thread for group_id: ${group_id}, community_id: ${community_id}`);
        const create_result = await graphql(CREATE_GROUP_THREAD, {community_id, group_id});
        if (!create_result.data || !create_result.data.insert_group_threads_one) {
            console.error(`Failed to create group_thread. Response:`, JSON.stringify(create_result, null, 2));
            throw new Error('Failed to create group_thread');
        }
        console.log(`Successfully created group_thread: ${create_result.data.insert_group_threads_one.id}`);
        return create_result.data.insert_group_threads_one;
    }

    static async create_group_and_invite(group_name, bot_phone, member_phone, permissions, community, make_admin = false, role_name) {
      const fetch = require('node-fetch');
      
      // Create Signal group via API
      const create_group_endpoint = `http://signal-cli:8080/v1/groups/${bot_phone}`;
      const group_data = {
          name: group_name,
          members: [member_phone, bot_phone],
          description: "Members of this group have " + permissions.join(", ") + " access to the Rhizal bot for " + community.name,
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
        const group_id = result.id.toString('base64').replace('group.', '');

        if (make_admin) {
          const make_admin_endpoint = `http://signal-cli:8080/v1/groups/${bot_phone}/group.${group_id}/admins`;
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
mutation CreateAdminGroupThread($community_id: uuid!, $group_id: String!, $permissions: [String!]!, $hashtag: String!) {
  insert_group_threads_one(object: {community_id: $community_id, group_id: $group_id, step: "done", permissions: $permissions, hashtag: $hashtag}) {
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

          const create_result = await graphql(CREATE_ADMIN_GROUP_THREAD, {community_id: community.id, group_id, permissions, hashtag: '#' + role_name});
          return create_result.data.insert_group_threads_one;
    }

}

module.exports = GroupThread;
module.exports = GroupThread;