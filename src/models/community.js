const { graphql } = require('../apis/graphql');

class Community {
    constructor(id, name, data = {}) {
        this.id = id;
        this.name = name;
        this.data = data;
    }

    static async get(bot_phone) {
        const query = `
query GetCommunities($bot_phone:String!) {
  communities(where: {bot_phone: {_eq: $bot_phone}}) {
	id
    name
    onboarding_id
  }
}
`;

        const variables = { bot_phone };

        const response = await graphql(query, variables);
        if (response.errors) {
            throw new Error(response.errors[0].message);
        }
        if (response.data.communities.length === 0) {
            return [];
        }
        const community = response.data.communities[0];
        return new Community(community.id, community.name, community);
    }

    static async get_bot_phones() {
        const query = `
query GetCommunities() {
  communities {
    bot_phone
  }
}
`;


        const response = await graphql(query);
        if (response.errors) {
            throw new Error(response.errors[0].message);
        }
        if (response.data.communities.length === 0) {
            return [];
        }
        return response.data.communities.map(c => c.bot_phone);
    }
}

module.exports = Community;