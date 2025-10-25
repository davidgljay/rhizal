const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { load_sql_schema, upload_metadata, create_system } = require('./initialization/db_init');
const { update_community_and_scripts, initial_message, set_admin, init_access_groups } = require('./initialization/script_sync');
const { promptSignalCaptchaUrl, getVerificationCodeFromSignalCaptchaUrl, verifySignalRegistrationCode, setSignalProfileName } = require('./initialization/signal_config');
const Message = require('./models/message');

async function initialize() {
    await initial_message();
    console.log('Initializing database');
    await load_sql_schema();
    console.log('Uploading metadata');
    await upload_metadata();
    console.log('Creating system');
    await create_system();

    console.log('Updating community and scripts');
    const community = await update_community_and_scripts();

    console.log('Setting up signal profile');
    const botPhone = community.bot_phone;
    const signalCaptchaUrl = await promptSignalCaptchaUrl();
    const verificationCode = await getVerificationCodeFromSignalCaptchaUrl(botPhone, signalCaptchaUrl);
    await verifySignalRegistrationCode(botPhone, verificationCode);
    await setSignalProfileName();
    const admin_phone = await set_admin(community);
    await init_access_groups(community, admin_phone);
    console.log('Setup complete! You should receive a message from Rhizal shortly. Please use "npm start" to start the bot.');
}
initialize().catch(console.error);