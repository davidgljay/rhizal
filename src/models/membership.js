const { graphql } = require('../apis/graphql');

class Membership {

    constructor(id, phone, user_id, type, data = {}, step = null, current_script = null) {
        this.id = id;
        this.phone = phone;
        this.user_id = user_id;
        this.type = type;
        this.step = step;
        this.current_script = current_script;
        this.data = data;

    }

    static async get(user_phone, bot_phone) {
        try {
            const query = `
query GetMembershipFromPhoneNumbers($phone: String = "", $bot_phone: String = "") {
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
      community_id
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
            const { id, type, step, current_script_id, user: { id: user_id, phone } } = response.data.memberships[0];
            return new Membership(id, phone, user_id, type, response.data.memberships[0], step, current_script_id);
        } catch (error) {
            console.error('Error getting membership:', error);
        }
    }


    async set_variable( variable, value) {
        const validVariables = ['name', 'informal_name', 'location', 'email', 'profile'];
        if (!validVariables.includes(variable)) {
            throw new Error(`Invalid variable. Valid variables are: ${validVariables.join(', ')}`);
        }
    
        try {
            const mutation = `
mutation updateMembershipVariable($id: ID!, $variable: String!, $value: String!) {
    updateMembershipVariable(id: $id, ${variable}: $value) {
        id
        ${variable}
    }
}
`;
            const variables = { id: this.id, value };
            return await graphql(mutation, variables);
        } catch (error) {
            console.error(`Error updating membership ${variable}:`, error);
        }
    }
    
    
    
    static async create(user_phone, community_id) {
        try {
            const createUserAndMembershipMutation = `
mutation CreateUserAndMembership($phone:String!, $community_id:uuid!) {
  insert_users_one(object: {phone: $phone, memberships: {data: {community_id: $community_id, type: "member"}}}) 
  {
    id
    phone
    memberships {
      id
    }
  }
}
`;

            const createMembershipMutation = `
mutation CreateMembership($user_id: uuid!, $community_id: uuid!) {
  insert_memberships_one(object: {user_id: $user_id, community_id: $community_id, type: "member"}) {
    id
  }
}
`;

const userQuery = `
query GetUser($phone: String!) {
    user(phone: $phone) {
        id
    }
}
`;

            let id, user_id;
            const userQueryResults = await graphql(userQuery, { phone: user_phone });
            if (userQueryResults.data.users.length > 0) {
                const mutationResults = await graphql(createMembershipMutation, { user_id: userQueryResults.data.users[0].id, community_id });
                id = mutationResults.data.insert_memberships_one.id;
                user_id = userQueryResults.data.users[0].id;
            } else {
                const mutationResults = await graphql(createUserAndMembershipMutation, { phone: user_phone, community_id });
                id = mutationResults.data.insert_users_one.memberships[0].id;
                user_id = mutationResults.data.insert_users_one.id;

            }
            return new Membership(id, user_phone, user_id, 'member');

        } catch (error) {
            console.error('Error creating membership:', error);
        }
    }

}

module.exports = Membership;



