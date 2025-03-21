const { graphql } = require('../apis/graphql');

class Membership {

    constructor(data) {
        const { id, type, step, current_script_id } = data;
        if (data.community) {
            this.bot_phone = data.community.bot_phone;
        }
        if (data.user) {
            this.user_id = data.user.id;
            this.phone = data.user.phone;
        }
        this.id = id;
        this.type = type;
        this.step = step;
        this.current_script_id = current_script_id;
        this.data = data;

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
    updateMembershipVariable(id: $id, ${variable}: $value) {
        id
        ${variable}
    }
}
`;
            this[variable] = value;
            const variables = { id: this.id};
            variables[variable] = value;
            return await graphql(mutation, variables);
        } catch (error) {
            console.error(`Error updating membership ${variable}:`, error);
        }
    }
    
    
    
    static async create(user_phone, community_id) {
        try {
            const createUserAndMembershipMutation = `
mutation CreateUserAndMembership($phone:String!, $community_id:uuid!) {
  insert_memberships_one(object: {user: {data: {phone: $phone}}, community_id: $community_id, type: "member", step: 0}}}) 
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
        onboarding_script_id
    }
  }
}
`;

            const createMembershipMutation = `
mutation CreateMembership($user_id: uuid!, $community_id: uuid!) {
  insert_memberships_one(object: {user_id: $user_id, community_id: $community_id, type: "member"}) {
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
        onboarding_script_id
    }
  }
}
`;

const userQuery = `
query GetUser($phone: String!) {
    users(phone: $phone) {
        id
    }
}
`;

            let mutationResults;
            const userQueryResults = await graphql(userQuery, { phone: user_phone });
            if (userQueryResults.data.users.length > 0) {
                mutationResults = await graphql(createMembershipMutation, { user_id: userQueryResults.data.users[0].id, community_id });
            } else {
                mutationResults = await graphql(createUserAndMembershipMutation, { phone: user_phone, community_id });
            }
            return new Membership(mutationResults.data.insert_memberships_one);

        } catch (error) {
            console.error('Error creating membership:', error);
        }
    }

}

module.exports = Membership;



