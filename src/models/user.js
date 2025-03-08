const { graphql } = require('../apis/graphql');

class User {

    constructor(id, phone) {
        this.id = id;
        this.phone = phone;
    }

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
            return await graphql(mutation, variables);
        } catch (error) {
            console.error(`Error updating user ${variable}:`, error);
        }
    }
    
    
    
    static async create(user_phone) {
        try {
            const mutation = `
mutation createUser($phone: String!) {
    createUser(phone: $phone) {
        id
        phone
    }
}
`;
            const variables = { phone: user_phone };
            const response = await graphql(mutation, variables);
            const {id, phone} = response.data.createUser;
            return new User(id, phone);

        } catch (error) {
            console.error('Error creating user:', error);
        }
    }

}

module.exports = User;



