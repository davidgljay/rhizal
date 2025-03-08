const User = require('../models/user');
const Message = require('../models/message');
const Script = require('../models/script');


export function receive_message(sender, recipient, message, sent_time) {
    if (!message) {
        return;
    }
    Message.create(sender, message, sent_time, recipient);
    const user = User.get(sender);
    if (!user) {
        new_user(sender);
        return;
    }
    if (user.step == 'done') {
        no_script_message(user);
        return;
    }
    script_message(user, message);
    return;
}

export function new_user(phone) {
    const user = User.create(phone);
    const script = new Script();
    script.init('onboarding', user.id);
    script.send('0')
    return;
}

export function no_script_message(user) {
    Message.send(user.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
    return;
}

export function script_message(user, message) {
    const script = new Script();
    script.init(user.script, user.id);
    script.receive(user.step, message);
    return;
}