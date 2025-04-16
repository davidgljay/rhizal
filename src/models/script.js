const { graphql } = require('../apis/graphql');
const RhizalParser = require('../helpers/rhizal_parser');
const { signal_timestamp } = require('./message');

class Script {
    constructor(script) {
        for (const key in script) {
            if (script.hasOwnProperty(key)) {
                this[key] = script[key];
            }
        }
        this.parser = new RhizalParser(script.script_json);
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

    async get_vars(membership, message, signal_timestamp) {
        this.vars = {
            id: membership.id,
            phone: membership.user.phone,
            bot_phone: membership.community.bot_phone,
            message,
            community_id: membership.community.id,
            signal_timestamp
        };
        if (this.vars_query) {
            const varsData = await graphql(this.vars_query, { membership_id: membership.id });
            this.vars = { ...this.vars, ...varsData.data.vars[0] };
        }

        return this.vars;
    }

    async get_targets() {
        try{
            const targetsData = await graphql({
                query: this.targets_query
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

    static async get_system_script(script_name) {
        const systemScriptQuery = `
query GetSystemScript($script_name: String!) {
    scripts(where: {name: {_eq: $script_name}, community: { name: {_eq: "system"}}}) {
        id
        name
        script_json
        vars_query
        targets_query
    }

}`;
        const systemScriptData = await graphql(systemScriptQuery, { script_name });
        if (systemScriptData.data.scripts.length === 0) {
            throw new Error(`System script ${script_name} not found`);
        }
        return new Script(systemScriptData.data.scripts[0]);
    }
}


module.exports = Script;