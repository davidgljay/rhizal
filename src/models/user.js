const { graphql } = require('../apis/graphql');

class User {

    static async set_variable(user_id, variable, value) {
        const validVariables = ['fname', 'fullname', 'location', 'email'];
        if (!validVariables.includes(variable)) {
            throw new Error(`Invalid variable. Valid variables are: ${validVariables.join(', ')}`);
        }
    
        try {
            const mutation = `
mutation updateUserVariable($id: ID!, $variable: String!, $value: String!) {
    updateUserVariable(id: $id, ${variable}: $value) {
        id
        ${variable}
    }
}
            `;
            const variables = { id: user_id, value };
            const response = await graphql(mutation, variables);
        } catch (error) {
            console.error(`Error updating user ${variable}:`, error);
        }
    }
    
    
    
    static async create(phone) {
        try {
            const mutation = `
mutation createUser($phone: String!) {
    createUser(phone: $phone) {
        id
        phone
    }
}
`;
            const variables = { phone };
            const response = await graphql(mutation, variables);
            const userData = response.data.createUser;
        } catch (error) {
            console.error('Error creating user:', error);
        }
    }

}

module.exports = User;



