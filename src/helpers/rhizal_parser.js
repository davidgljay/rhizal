const yaml = require('js-yaml');


/* 
The function below is the implementation of the parse function in the rhyzal_parser.spec.js file
The function takes in three parameters: yaml_script, step, and vars
  yaml_script:  the yaml script that contains the messages to be sent
  step: the step in the yaml script to be executed
  vars: variables to be replaced in the messages, these are generated by a graphql query with the same name as the script
The function parses the yaml script, replaces the variables in the messages, and sends the messages using the send_message and send_attachment functions
*/
class RhyzalParser {

    constructor(yaml_script, send_message, send_attachment, set_user_variable) {
        let script_obj;
        this.send_message = send_message;
        this.send_attachment = send_attachment;
        this.set_user_variable = set_user_variable;
        try {
            script_obj = yaml.load(yaml_script);
        }
        catch (e) {
            throw new Error('Invalid yaml input ' + e);
        }
        this.script = script_obj.script;
    }

    send(step, vars) {
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

            for (let i = 0; i < messages.length; i++) {
                if (messages[i].match(/attach\(([^)]+)\)/)) {
                    const file = messages[i].match(/attach\(([^)]+)\)/)[1];
                    this.send_attachment(file);
                } else {
                    let message = messages[i];
                    for (const key in vars) {
                        message = message.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
                    }
                    this.send_message(message);
                }
            }
    }

    receive(step, vars) {
        if (!this.script) {
            throw new Error('Script not initialized');
        }
        if (!this.script[step]) {
            throw new Error('Step missing from script');
        }
        this.evaluate_receive(this.script[step].on_receive, vars);
    }

    evaluate_receive(script, vars) {
        switch(Object.keys(script)[0]) {
            case 'user_status':
                const new_status = script['user_status'];
                this.set_user_variable(vars.user_id, 'status', new_status);
                this.send(new_status, vars);
                break;
            case 'set_variable':
                this.set_user_variable(vars.user_id, script['set_variable']['variable'], script['set_variable']['value']);
                break;
            case 'if':
                if (this.evaluate_condition(script.if, vars)) {
                    for (let i = 0; i < script.then.length; i++) {
                        this.evaluate_receive(script.then[i], vars);
                    }
                } else {
                    if (script.else) {
                        for (let i = 0; i < script.else.length; i++) {
                            this.evaluate_receive(script.else[i], vars);
                        }
                    }
                }
                break;
        }
    };

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
            const matches = condition.match(/regex\(([^,]+),\s*([^)]+)\)/);
            if (matches) {
                const var_name = matches[1];
                let match = matches[2];
                match.trim();
                if (match.startsWith('/') && match.endsWith('/')) {
                    match = match.slice(1, -1); // Remove the leading and trailing slashes
                    return new RegExp(match).test(vars[var_name]);
                } else {
                    return vars[var_name] == vars[match];
                }
            }
        } else {
            // If the condition is a variable, return the value of the variable
            return !!vars[condition];
        }
    };

}

module.exports = RhyzalParser;