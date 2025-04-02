const yaml = require('js-yaml');


/* 
The function below is the implementation of the parse function in the rhyzal_parser.spec.js file
The function takes in three parameters: yaml_script, step, and vars
  yaml_script:  the yaml script that contains the messages to be sent
  step: the step in the yaml script to be executed
  vars: variables to be replaced in the messages, these are generated by a graphql query with the same name as the script
     vars should contain:
        phone: the phone number of the user
        bot_phone: the phone number of the bot sending the message
The function parses the yaml script, replaces the variables in the messages, and sends the messages using the send_message and send_attachment functions
*/
class RhyzalParser {

    constructor(script_json, send_message, set_variable, set_group_variable) {
        let script_obj;
        this.send_message = send_message;
        this.set_variable = set_variable;
        this.set_group_variable = set_group_variable;
        try {
            script_obj = JSON.parse(script_json);
        }
        catch (e) {
            throw new Error('Invalid yaml input ' + e);
        }
        this.script = script_obj;
    }

    async send(step, vars) {
            if (!this.script) {
                throw new Error('Script not initialized');
            }
            if (step == 'done') {
                return;
            };
            if (!this.script[step]) {
                throw new Error('Step missing from script');
            }
            const messages = this.script[step].send;
            const { community_id, id } = vars;
            let recipient = vars.phone;
            let log_message = true;
            if (vars.group_id) {
                recipient = vars.group_id;
                log_message = false;
            };
            for (let i = 0; i < messages.length; i++) {
                //Send a message with an attachement
                // if (messages[i].match(/attach\(([^)]+)\)/)) {

                //     const file = messages[i].match(/attach\(([^)]+)\)/)[1];
                //     //TODO: update to include user_phone number and format properly 
                //     this.send_message('', file);
                // } else {
                    let message = messages[i];
                    for (const key in vars) {
                        message = message.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
                    }
                    await this.send_message(community_id, id, recipient, vars.bot_phone, message, log_message);
                // }
            }
    }

    async receive(step, vars) {
        if (!this.script) {
            throw new Error('Script not initialized');
        }
        if (!this.script[step]) {
            throw new Error('Step missing from script');
        }
        if (Array.isArray(this.script[step].on_receive)) {
            for (let i = 0; i < this.script[step].on_receive.length; i++) {
                await this.evaluate_receive(this.script[step].on_receive[i], vars);
            }
        } else {
            await this.evaluate_receive(this.script[step].on_receive, vars);
        }
    }

    async evaluate_receive(script, vars) {
        switch(Object.keys(script)[0]) {
            case 'step':
                const new_step = String(script['step']);
                if (vars.group_id) {
                    await this.set_group_variable(vars.group_id, 'step', new_step);
                } else {
                    await this.set_variable(vars.id, 'step', new_step);
                }
                await this.send(new_step, vars);
                break;
            case 'set_variable':
                //TODO: add tests for setting variable with regex
                if (script['set_variable']['value'].includes('regex')) {
                    await this.set_variable(vars.id, script['set_variable']['variable'], this.regex_match(script['set_variable']['value'], vars));
                } else {
                    await this.set_variable(vars.id, script['set_variable']['variable'], script['set_variable']['value']);
                }
                break;
            case 'set_group_variable':
                if (!vars.group_id) {
                    throw new Error('Group ID not found in vars');
                }
                if (script['set_group_variable']['value'].includes('regex')) {
                    await this.set_group_variable(vars.group_id, script['set_group_variable']['variable'], this.regex_match(script['set_group_variable']['value'], vars));
                } else {
                    await this.set_group_variable(vars.group_id, script['set_group_variable']['variable'], script['set_group_variable']['value']);
                }
                break;
            case 'if': //TODO: add elif to support more complex logic
                if (this.evaluate_condition(script.if, vars)) {
                    if (script.then) {
                        if (Array.isArray(script.then)) {
                            for (let i = 0; i < script.then.length; i++) {
                                await this.evaluate_receive(script.then[i], vars);
                            }
                        } else {
                            await this.evaluate_receive([script.then], vars);
                        }
                    } 
                } else if (script.else) {
                    if (Array.isArray(script.else)) {
                        for (let i = 0; i < script.else.length; i++) {
                            await this.evaluate_receive(script.else[i], vars);
                        }
                    } else {
                        await this.evaluate_receive(script.else, vars);
                    }
                }
                break;
        }

    };

    regex_match(condition, vars) {
        const [full, variable, match] = condition.match(/regex\(([^,]+), ([^)]+)\)/);
        const regex_match = new RegExp((match.trim().slice(1, -1))).exec(vars[variable]);
        if (regex_match) {
            return regex_match[0];
        } else {
            return null;
        }
    }

    evaluate_condition(condition, vars) {
        // If the condition is a regex, evaluate it against a variable
        if (condition.or) {
            for (let i = 0; i < condition.or.length; i++) {
                if (this.evaluate_condition(condition.or[i], vars)) {
                    return true;
                }
            }
            return false;
        } else if (condition.and) {
            for (let i = 0; i < condition.and.length; i++) {
                if (!this.evaluate_condition(condition.and[i], vars)) {
                    return false;
                }
            }
            return true;
        } else  if (condition.match(/regex\(([^)]+)\)/)) {
            const matches = condition.match(/regex\(([^,]+), ([^)]+)\)/);
            const variable = matches[1];
            let match = matches[2];
            if (!vars[variable]) {
                throw new Error('Condition not found in vars for regex');
            }
            if (matches) {
                match.trim();
                if (match.startsWith('/') && match.endsWith('/')) {
                    match = match.slice(1, -1); // Remove the leading and trailing slashes
                    return new RegExp(match).test(vars[variable]);
                } else {
                    return vars[variable] == vars[match];
                }
            }
        } else {
            // If the condition is a variable, return the value of the variable
            return !!vars[condition];
        }
    };

}

module.exports = RhyzalParser;