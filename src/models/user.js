import { graphql } from '../apis/graphql';

class User {
    constructor() {
        this.id = null;
        this.script = '';
        this.status = '';
        this.phone = '';
        this.created_time = null;
        this.profile= {};
    }

    async get(phone) {
        try {
            const query = `
                query getUser($phone: String!) {
                    user(phone: $phone) {
                        id
                        script
                        status
                        phone
                        created_time
                        fname
                        lname
                        location
                        email
                    }
                }
            `;
            const variables = { phone };
            const response = await graphql(query, variables);
            const userData = response.data.user;
            this.id = userData.id;
            this.script = userData.script;
            this.status = userData.status;
            this.phone = userData.phone;
            this.created_time = userData.created_time;
            this.profile = {
                fname: userData.fname,
                lname: userData.lname,
                location: userData.location,
                email: userData.email,
            };
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    async set_profile(profileData) {
        if (!this.id) {
            throw new Error('User data has not been populated.');
        }
        try {
            const mutation = `
                mutation updateUserProfile($id: ID!, $profile: ProfileInput!) {
                    updateUserProfile(id: $id, profile: $profile) {
                        id
                        fname
                        lname
                        location
                        email
                    }
                }
            `;
            const variables = { id: this.id, profile: profileData };
            const response = await graphql(mutation, variables);
            this.profile = response.data.updateUserProfile.profile;
        } catch (error) {
            console.error('Error updating user profile:', error);
        }
    }

    async set_status(script, status) {
        if (!this.id) {
            throw new Error('User data has not been populated.');
        }
        try {
            const mutation = `
                mutation updateUserStatus($id: ID!, $script: String!, $status: String!) {
                    updateUserStatus(id: $id, script: $script, status: $status) {
                        id
                        script
                        status
                    }
                }
            `;
            const variables = { id: this.id, script, status };
            const response = await graphql(mutation, variables);
            this.script = response.data.updateUserStatus.script;
            this.status = response.data.updateUserStatus.status;
        } catch (error) {
            console.error('Error updating user status:', error);
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
            const user = new User();
            user.id = userData.id;
            user.phone = userData.phone;
            return user;
        } catch (error) {
            console.error('Error creating user:', error);
        }
    }
}

export default User;