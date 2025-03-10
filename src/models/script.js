const { graphql } = require('../apis/graphql');
const RhizalParser = require('../helpers/rhizal_parser');
const Message = require('./message');
const User = require('./user');

class Script {
    constructor() {
        this.id = '';
        this.name = '';
        this.yaml = '';
        this.varsquery = '';
        this.targetquery = '';
        this.parser = null;
    }

    async init(name, user_id) {
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

        this.id = scriptData.data.GetScript.script.id;
        this.name = scriptData.data.GetScript.script.name;
        this.yaml = scriptData.data.GetScript.script.yaml;
        this.varsquery = scriptData.data.GetScript.script.varsquery;
        this.targetquery = scriptData.data.GetScript.script.targetquery;
        this.parser = new RhizalParser(this.yaml, Message.send, User.set_variable)
        await this.get_vars(user_id);
        return 
    }

    async get_vars(user_id) {
        try{
            const varsData = await graphql({
                query: this.varsquery,
                variables: { user_id }
            });
            this.vars = varsData.data
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
            this.targets = targetsData.data;
            return targetsData.data;    
        } catch (error) {
            if (error.message) {
                throw new Error(error.message);
            } else {
                throw new Error('Unknown error fetcthing target data');
            }
        }
    }

    async send(step) {
        console.log('sending message via parser')
       return await this.parser.send(step, this.vars);
    }

    async receive(step, message) {
        return await this.parser.receive(step, this.vars, message)
    }

}

module.exports = Script;