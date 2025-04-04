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

import { receive_message, receive_group_message } from '../handlers/receive_message';

export async function receive_raw_message(msg) {
    if (!msg || !msg.envelope || !msg.envelope.dataMessage) {
        return;
    }
    const { envelope: {source, timestamp, sourceName, dataMessage: {message, groupInfo}}, account } = msg;
    if (groupInfo) { 
        receive_group_message(groupInfo.groupId, message, source, account, sourceName, timestamp);
        return;
    }
    console.log(`Received message from ${source} to ${account} at ${timestamp}: ${message}`);
    receive_message(source, account, message, timestamp);
};