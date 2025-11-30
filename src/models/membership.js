const { graphql } = require('../apis/graphql');

class Membership {

    constructor(data) {
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                this[key] = data[key];
            }
        }
    }

    static async get(user_phone, bot_phone) {
        try {
            const query = `
query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!) {
  memberships(where: {user:{phone: {_eq: $phone}}, community: {bot_phone: {_eq: $bot_phone}}}) {
      id
      profile
      permissions
      name
      step
      permissions
      current_script_id
      informal_name
	    intro {
        text
      }
      community {
        id
        bot_phone
        onboarding_id
      }
      user {
        id
        phone
      }
  }
}

`;
            const variables = { phone: user_phone, bot_phone };
            const response = await graphql(query, variables);
            if (response.data.memberships.length === 0) {
                return null;
            }
            return new Membership(response.data.memberships[0]);
        } catch (error) {
            console.error('Error getting membership:', error);
        }
    }

    static async set_variable(id, variable, value) {
        return new Membership({id}).set_variable(variable, value);
    }

    static async update_permissions(id, permissions) {
        // First get the current permissions
        const getCurrentPermissionsQuery = `
query GetCurrentPermissions($id:uuid!) {
  memberships(where: {id: {_eq: $id}}) {
    permissions
  }
}
`;
        const currentResponse = await graphql(getCurrentPermissionsQuery, { id });
        const oldPermissions = currentResponse.data.memberships.length > 0 
            ? currentResponse.data.memberships[0].permissions || [] 
            : [];
        
        const query = `
mutation UpdatePermissions($id:uuid!, $permissions:[String!]) {
  update_memberships(where: {id: {_eq: $id}}, _set: {permissions: $permissions}) {
    returning {
      id
      permissions
    }
  }
}
`;
        const uniquePermissions = [...new Set(permissions)];
        const variables = { id, permissions: uniquePermissions};
        const result = await graphql(query, variables);
        
        // Return both old and new permissions for comparison
        return {
            oldPermissions,
            newPermissions: uniquePermissions,
            result
        };
    }

    static async add_permissions(id, permissions) {
        const query = `
mutation AddPermissions($id:uuid!, $permissions:String!) {
  update_memberships(where: {id: {_eq: $id}}, _set: {permissions: $permissions}) {
    returning {
      id
    }
  }
}
`;
        const variables = { id, permissions };
        return await graphql(query, variables);
    }

    static async remove_permissions(id, permissions) {
        const query = `
mutation RemovePermissions($id:uuid!, $permissions:String!) {
  update_memberships(where: {id: {_eq: $id}}, _set: {permissions: $permissions}) {
    returning {
      id
    }
  }
}
`;
        const variables = { id, permissions };
        return await graphql(query, variables);
}

    async set_variable(variable, value) {
        const validVariables = ['name', 'informal_name', 'location', 'email', 'profile', 'step', 'current_script_id', 'type'];
        const variableTypes = {
            name: 'String',
            informal_name: 'String',
            location: 'String',
            email: 'String',
            profile: 'String',
            step: 'String',
            current_script_id: 'uuid',
            type: 'String'
        }
        if (!validVariables.includes(variable)) {
            throw new Error(`Invalid variable. Valid variables are: ${validVariables.join(', ')}`);
        }
    
        try {
            const mutation = `
mutation updateMembershipVariable($id:uuid!, $value:${variableTypes[variable]}!) {
  update_memberships(where: {id: {_eq: $id}}, _set: {${variable}: $value}) {
    returning {
      id
    }
  }
}
`;

            this[variable] = value;
            const variables = { id: this.id, value};
            return await graphql(mutation, variables);
        } catch (error) {
            console.error(`Error updating membership ${variable}:`, error);
        }
    }
    
    static async create_admin(user_phone, community) {
        const createUserAndAdminMutation = `
mutation CreateUserAndMembership($phone:String!, $community_id:uuid!) {
  insert_memberships_one(
    object: {
        user: {
            data: {phone: $phone}
        }, 
        community_id: $community_id, 
        permissions: ["announcement", "group_comms", "onboarding"], 
        step: "done"
        }) 
  {
    id
    step
    permissions
    current_script_id
    user {
        id
        phone
    }
    community {
        id
        bot_phone
        onboarding_id
    }
  }
}
`;
        const mutationResults = await graphql(createUserAndAdminMutation, { phone: user_phone, community_id: community.id});
        return new Membership(mutationResults.data.insert_memberships_one);
    }
    
    static async create(user_phone, community, user) {
        try {
            const createMembershipMutation = `
mutation CreateMembership($user_id:uuid!, $community_id:uuid!, $current_script_id:uuid!) {
  insert_memberships_one(
    object: {
        user_id: $user_id,
        community_id: $community_id,
        permissions: [],
        step: "0",
        current_script_id: $current_script_id
    }) {
        id
        permissions
        step
        permissions
        current_script_id
        user {
            id
            phone
        }
        community {
            id
            bot_phone
            onboarding_id
        }
  }
}
`;

const createUserAndMembershipMutation = `
mutation CreateUserAndMembership($phone:String!, $community_id:uuid!, $current_script_id:uuid!) {
  insert_memberships_one(
    object: {
        user: {
            data: {phone: $phone}
        }, 
        community_id: $community_id, 
        current_script_id: $current_script_id,
        permissions: [],
        step: "0"
        }) 
  {
    id
    step
    permissions
    current_script_id
    user {
        id
        phone
    }
    community {
        id
        bot_phone
        onboarding_id
    }
  }
}
`;

            let mutationResults;
            if (user) {
                mutationResults = await graphql(createMembershipMutation, { user_id: user.id, community_id: community.id, current_script_id: community.onboarding.id });
            } else {
                mutationResults = await graphql(createUserAndMembershipMutation, { phone: user_phone, community_id: community.id, current_script_id: community.onboarding.id });
            }
            return new Membership(mutationResults.data.insert_memberships_one);

        } catch (error) {
            console.error('Error creating membership:', error);
        }
    }

}



module.exports = Membership;



