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
        role
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
    role
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

    static async create_group_and_invite(group_name, bot_phone, member_phone, community) {
        const fetch = require('node-fetch');
        
        // Create Signal group via API
        const create_group_endpoint = `http://signal-cli:8080/v1/groups/${bot_phone}`;
        const group_data = {
            name: group_name,
            members: [member_phone],
            description: "Members of this group have admin access to the Rhizal bot for " + community.name,
            expiration_time: 0,
            group_link: "disabled",
            permissions: {
                add_members: "only-admins",
                edit_group: "only-admins",
                send_messages: "all_members"
              }
            };

        try {
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
            //TODO: Confirm that this is the proper format for the response.
            const group_id = Buffer.from(result[0].id).toString('base64');

            // Store group in database with admin role
            const CREATE_ADMIN_GROUP_THREAD = `
mutation CreateAdminGroupThread($community_id: uuid!, $group_id: String!) {
  insert_group_threads_one(object: {community_id: $community_id, group_id: $group_id, step: "done", role: "admin"}) {
	id
    group_id
    step
    hashtag
    role
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

            const create_result = await graphql(CREATE_ADMIN_GROUP_THREAD, {community_id: community.id, group_id});
            return create_result.data.insert_group_threads_one;

        } catch (error) {
            console.error('Error creating admin group:', error);
            throw error;
        }
    }

    static async is_registered_user(phone, community_id) {
        const CHECK_USER_QUERY = `
query CheckRegisteredUser($phone: String!, $community_id: uuid!) {
    memberships(where: {user: {phone: {_eq: $phone}}, community_id: {_eq: $community_id}}) {
        id
    }
}`;

        try {
            const result = await graphql(CHECK_USER_QUERY, { phone, community_id });
            return result.data.memberships.length > 0;
        } catch (error) {
            console.error('Error checking user registration:', error);
            return false;
        }
    }

    static async handle_member_join_or_leave(group_id, member_phone, bot_phone, join = false) {
        const GET_GROUP_ROLE_QUERY = `
query GetGroupRole($group_id: String!) {
    group_threads(where: {group_id: {_eq: $group_id}}) {
        id
        role
        community_id
    }
}`;

        try {
            const result = await graphql(GET_GROUP_ROLE_QUERY, { group_id });
            
            if (result.data.group_threads.length === 0) {
                return; // Group not found in our database
            }

            const group_thread = result.data.group_threads[0];
            
            if (group_thread.role === 'admin') {
                const is_registered = await this.is_registered_user(member_phone, group_thread.community_id);
                
                if (is_registered) {
                    // Update user's membership type to admin
                    const Membership = require('./membership');
                    const membership = await Membership.get(member_phone, bot_phone);
                    
                    if (membership) {
                        if (join) {
                            await membership.set_variable('type', 'admin');
                        }
                        else {
                            await membership.set_variable('type', 'member');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error handling member join:', error);
        }
    }
}

module.exports = GroupThread;