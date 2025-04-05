const { graphql } = require('../apis/graphql');
const RhizalParser = require('../helpers/rhizal_parser');
const Message = require('./message');
const Membership = require('./membership');
const GroupThread = require('./group_thread');

class Script {
    constructor(script) {
        for (const key in script) {
            if (script.hasOwnProperty(key)) {
                this[key] = script[key];
            }
        }
        this.parser = new RhizalParser(script.script_json, Message.send, Membership.set_variable, GroupThread.set_variable);
    }

    static async init(id) {
        const scriptData = await graphql(`
query GetScript($id:uuid!) {
    scripts(where: {id: {_eq:$id}}) {
        id
        name
        script_json
        vars_query
        targets_query
    }
}
`
        ,{ id });

        const script = new Script(scriptData.data.scripts[0]);
        return script;
    }

    async get_vars(membership, message) {
        if (!this.vars_query) {
            this.vars = {
                id: membership.id,
                phone: membership.user.phone,
                bot_phone: membership.community.bot_phone,
                message,
                community_id: membership.community.id
            }
            return this.vars;
        }
        const varsData = await graphql(this.vars_query, { membership_id: membership.id });
        this.vars = varsData.data.vars[0];
        this.vars.id = membership.id;
        this.vars.phone = membership.user.phone;
        this.vars.bot_phone = membership.community.bot_phone;
        this.vars.message = message;
        this.vars.community_id = membership.community.id;
        return this.vars;
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