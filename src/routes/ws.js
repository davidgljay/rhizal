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

import { receive_message, receive_group_message, receive_reply } from '../handlers/receive_message';

export async function receive_raw_message(msg) {
    if (!msg || !msg.envelope || !msg.envelope.dataMessage) {
        return;
    }
    const { envelope: {sourceUuid, timestamp, sourceName, dataMessage: {message, groupInfo, quote}}, account } = msg;
    if (groupInfo) { 
        receive_group_message(groupInfo.groupId, message, sourceUuid, account, sourceName, timestamp);
        return;
    }
    if (quote && quote.author == account) {
        receive_reply(message, sourceUuid, account, quote.id, timestamp, sourceName);
        return;
    }
    receive_message(sourceUuid, account, message, timestamp, sourceName);
};