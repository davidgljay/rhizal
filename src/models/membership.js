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
      type
      name
      step
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


    async set_variable(variable, value) {
        const validVariables = ['name', 'informal_name', 'location', 'email', 'profile', 'step', 'current_script_id'];
        const variableTypes = {
            name: 'String',
            informal_name: 'String',
            location: 'String',
            email: 'String',
            profile: 'String',
            step: 'String',
            current_script_id: 'uuid'
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
    
    
    
    static async create(user_phone, community, user) {
        try {
            const createUserAndMembershipMutation = `
mutation CreateUserAndMembership($phone:String!, $community_id:uuid!, $current_script_id:uuid!) {
  insert_memberships_one(
    object: {
        user: {
            data: {phone: $phone}
        }, 
        community_id: $community_id, 
        current_script_id: $current_script_id,
        type: "member", 
        step: "0"
        }) 
  {
    id
    type
    step
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

            const createMembershipMutation = `
mutation CreateMembership($user_id:uuid!, $community_id:uuid!, $current_script_id:uuid!) {
  insert_memberships_one(
    object: {
        user_id: $user_id,
        community_id: $community_id,
        type: "member",
        step: "0",
        current_script_id: $current_script_id
    }) {
        id
        type
        step
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



