const { graphql } = require('../apis/graphql');

class Script {
    constructor(id, name, yaml, varsquery, targetquery) {
        this.id = id;
        this.name = name;
        this.yaml = yaml;
        this.varsquery = varsquery;
        this.targetquery = targetquery;
    }

    static async get(name) {

        try {
        const scriptData = await graphql({
            query: `
query GetScript($name: String!) {
    script(name: $name) {
        id
        name
        yaml
        varsquery
        targetquery
    }
}
`,
            variables: { name }
        });

        const { id, yaml, varsquery, targetquery } = scriptData.data.script;
        return new Script(id, name, yaml, varsquery, targetquery);
        } catch (error) {
            if (error.message) {
                throw new Error(error.message);
            } else {
                throw new Error('Unknown error getting script data');
            }
        }
    }

    async get_vars(user_id) {
        try{
            const varsData = await graphql({
                query: this.varsquery,
                variables: { user_id }
            });
    
            return varsData.data;    
        } catch (error) {
            if (error.message) {
                throw new Error(error.message);
            } else {
                throw new Error('Unknown error fetcthing vars data');
            }
        }
    }

    async get_targets() {
        try{
            const targetsData = await graphql({
                query: this.targetquery
            });
    
            return targetsData.data;    
        } catch (error) {
            if (error.message) {
                throw new Error(error.message);
            } else {
                throw new Error('Unknown error fetcthing target data');
            }
        }
    }
}

module.exports = Script;