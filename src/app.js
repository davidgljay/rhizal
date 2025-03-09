const webSocketManager = require('./apis/signal');
const { receive_raw_message } = require('./routes/ws');

webSocketManager.connect(receive_raw_message);

