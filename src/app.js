// const express = require('express');
// const bodyParser = require('body-parser');
// const routes = require('./routes/router');
const WebSocket = require('ws');
const { receive_raw_message } = require('./routes/ws');

// const app = express();
const PORT = process.env.PORT || 3000;
const phone = process.env.ACCOUNT_PHONE;

// app.use(bodyParser.json());
// app.use('/api', routes());

console.log('Connecting to WebSocket for ' + phone + '... ');

const ws = new WebSocket('ws://signal-cli:8080/v1/receive/' + phone);

ws.on('open', function open() {
    console.log('WebSocket connection established');
});

ws.on('close', function close() {
    console.log('WebSocket connection closed');
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});

ws.on('message', function incoming(data) {
  try {
    console.log('Received WebSocket message:', JSON.parse(data));
    receive_raw_message(JSON.parse(data));
  }
  catch (e) {
    console.error('Error parsing WebSocket message:', e);
    console.error('WebSocket message:', data);
  }
});

// app.listen(PORT, () => {
//   console.log(`Server is running on http://localhost:${PORT}`);
// });