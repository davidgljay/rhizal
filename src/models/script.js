const { graphql } = require('../apis/graphql');
const RhizalParser = require('../helpers/rhizal_parser');
const Message = require('./message');
const Membership = require('./membership');

class Script {
    constructor({id, name, yaml, varsquery, targetquery}) {
        this.id = id;
        this.name = name;
        this.yaml = yaml;
        this.varsquery = varsquery;
        this.targetquery = targetquery;
        this.parser = null;
    }

    static async init(id) {
        const scriptData = await graphql(`
query GetScript($id:uuid!) {
    script(id: $id) {
        id
        name
        yaml
        varsquery
        targetquery
    }
}
`
        ,{ id });

        const script = new Script(scriptData.data.script);
        script.parser = new RhizalParser(script.yaml, Message.send, Membership.set_variable)
        return script;
    }

    async get_vars(membership) {
        if (!this.varsquery) {
            this.vars = {
                id: membership.id,
                phone: membership.phone,
                bot_phone: membership.bot_phone,
            }
            return this.vars;
        }
        const varsData = await graphql(this.varsquery, { membership_id: membership.id });
        this.vars = varsData.data.vars[0];
        this.vars.id = membership.id;
        this.vars.phone = membership.phone;
        this.vars.bot_phone = membership.bot_phone;
        return {
            id: membership.id,
            phone: membership.phone,
            bot_phone: membership.bot_phone,
            ...varsData.data.vars[0]
        };
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