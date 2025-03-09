const express = require('express');
const router = express.Router();

/*
Example payload from Signal API:
   {
        "envelope": {
            "source": "+11234567890",
            "sourceNumber": "+11234567890",
            "sourceUuid": "UUID",
            "sourceName": "User_name",
            "sourceDevice": 1,
            "timestamp": 1741473723341,
            "serverReceivedTimestamp": 1741473723452,
            "serverDeliveredTimestamp": 1741473843777,
            "syncMessage": {
                "sentMessage": {
                    "destination": "+11234567890",
                    "destinationNumber": "+11234567890",
                    "destinationUuid": "UUID",
                    "timestamp": 1741473723341,
                    "message": "Test",
                    "expiresInSeconds": 0,
                    "viewOnce": false
                }
            }
        },
        "account": "+11234567890"
    }
    
    envelope.syncMessage will be undefined if there is no message.
*/

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

module.exports = () => router;