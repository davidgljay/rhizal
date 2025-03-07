const { graphql } = require('../apis/graphql');

class Script {
    constructor() {
        this.id = '';
        this.name = '';
        this.yaml = '';
        this.varsquery = '';
        this.targetquery = '';
    }

    async get(name) {

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

        this.id = scriptData.data.script.id;
        this.name = scriptData.data.script.name;
        this.yaml = scriptData.data.script.yaml;
        this.varsquery = scriptData.data.script.varsquery;
        this.targetquery = scriptData.data.script.targetquery;
        return 
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