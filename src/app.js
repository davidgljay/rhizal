const webSocketManager = require('./apis/signal');
const { receive_raw_message } = require('./routes/ws');
const Community = require('./models/community');

Community.get_bot_phones().then(bot_phones => {
    bot_phones.forEach(bot_phone => {
        webSocketManager.connect(receive_raw_message, bot_phone);
    });
});
