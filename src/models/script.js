const { graphql } = require('../apis/graphql');
const RhizalParser = require('../helpers/rhizal_parser');
const Message = require('./message');
const User = require('./user');

class Script {
    constructor(name) {
        this.id = '';
        this.name = '';
        this.yaml = '';
        this.varsquery = '';
        this.targetquery = '';
        this.parser = null;
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
        this.parser = new RhizalParser(this.yaml, Message.send_message, User.set_variable)
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
       return await this.parser.send(step, this.vars);
    }

    async receive(step, message) {
        return await this.parser.receive(step, this.vars, message)
    }

}

module.exports = Script;