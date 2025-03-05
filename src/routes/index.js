const express = require('express');
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

module.exports = router;