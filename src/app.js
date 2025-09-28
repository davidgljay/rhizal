const webSocketManager = require('./apis/signal');
const { receive_raw_message } = require('./routes/ws');
const Community = require('./models/community');
const { load_sql_schema, upload_metadata, create_system } = require("./initialization/db_init.js");

Community.get_bot_phones()
    .then(bot_phones => {
    bot_phones.forEach(bot_phone => {
        webSocketManager.connect(receive_raw_message, bot_phone);
    });
    })
    // .catch(async (err) => {
    //     console.log(err)
    //     if (err.message && err.message.includes("field 'communities' not found")) {
    //         console.log('Looks like a fresh install!')
    //         console.log('Setting up DB schema...')
    //         await load_sql_schema();
    //         console.log('Loading metadata to Hasura...')
    //         await upload_metadata();
    //         console.log('Setting up system-level scripts...')
    //     } else {
    //         throw err;
    //     }
    // });
