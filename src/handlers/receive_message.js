const User = require('../models/user');
const Message = require('../models/message');
const Script = require('../models/script');

export function new_user(phone) {
    const user = User.create(phone);
    const script = new Script();
    script.init('onboarding', user.id);
    script.send('0')
    return;
}

export function no_script_message(user) {
    Message.send_message(user.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
    return;
}

export function script_message(user, message) {
    const script = new Script();
    script.init(user.script, user.id);
    script.receive(user.step, message);
    return;
}