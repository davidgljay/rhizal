const express = require('express');
const WebSocket = require('ws');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('Welcome to the Node.js application!');
});

router.post('/data', (req, res) => {
    const data = req.body;
    res.json({
        message: 'Data received successfully!',
        receivedData: data
    });
});

router.get('/initialize', (req, res) => {
    const ws = new WebSocket('https://signal-api/websocket');

    ws.on('open', function open() {
        ws.send('Connection established');
        res.send('WebSocket connection established');
    });

    ws.on('error', function error(err) {
        console.error('WebSocket error:', err);
        res.status(500).send('WebSocket connection failed');
    });
});

module.exports = router;