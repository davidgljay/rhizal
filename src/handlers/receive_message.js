const User = require('../models/user');
const Message = require('../models/message');
const Script = require('../models/script');


export async function receive_message(sender, recipients, message, sent_time) {
    if (!message) {
        return;
    }
    Message.create(sender, recipients, message, sent_time);
    const user = await User.get(sender);
    if (!user) {
        await new_user(sender);
        return;
    }
    if (user.step == 'done') {
        await no_script_message(user);
        return;
    }
    await script_message(user, message);
    return;
}

export async function new_user(phone) {
    const user = await User.create(phone);
    const script = new Script();
    await script.init('onboarding', user.id);
    await script.send('0')
    return;
}

export async function no_script_message(user) {
    await Message.send(user.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
    return;
}

export async function script_message(user, message) {
    const script = new Script();
    await script.init(user.script, user.id);
    await script.receive(user.step, message);
    return;
}