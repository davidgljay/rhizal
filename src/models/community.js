const { graphql } = require('../apis/graphql');

class Community {
    constructor(id, name, bot_phone, data = {}, ) {
        this.id = id;
        this.name = name;
        this.data = data;
        this.bot_phone = bot_phone;
    }

    static async get(bot_phone) {
        const query = `
query GetCommunities($bot_phone:String!) {
  communities(where: {bot_phone: {_eq: $bot_phone}}) {
	id
    name
    bot_phone
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
            return null;
        }
        const community = response.data.communities[0];
        return new Community(community.id, community.name, community);
    }

    static async update(community_config) {
        const communityData = await graphql(`
        mutation UpdateCommunity($id:uuid!, $name:String!, $description:String!, $bot_phone:String!) {
            update_communities_by_pk(pk_columns: {id: $id}, _set: {name: $name, description: $description, bot_phone: $bot_phone}) {
                id
                name
                bot_phone
                description
            }
        }
        `
        ,{ id: community_config.id, name: community_config.name, description: community_config.description, bot_phone: community_config.bot_phone });
        return communityData.data.update_communities_by_pk;
    }

    static async create(community_config) {
        const communityData = await graphql(`
        mutation CreateCommunity($name:String!, $description:String!, $bot_phone:String!) {
            insert_communities_one(object: {name: $name, description: $description, bot_phone: $bot_phone}) {
                id
                name
                bot_phone
                description
            }
        }
        `
        ,{ id: community_config.id, name: community_config.name, description: community_config.description, bot_phone: community_config.bot_phone });
        return communityData.data.insert_communities_one;
    }

    static async get_bot_phones() {
        const query = `
query GetCommunities {
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