const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { load_sql_schema, upload_metadata, create_system } = require('./initialization/db_init');
const { update_community_and_scripts, initial_message, set_admin } = require('./initialization/script_sync');
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
    await set_admin(community);

    console.log('Setting up signal profile');
    const configPath = path.join(__dirname, '../scripts_config/community_config.yml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);
    const botPhone = config.community.bot_phone;
    const signalCaptchaUrl = await promptSignalCaptchaUrl();
    const verificationCode = await getVerificationCodeFromSignalCaptchaUrl(botPhone, signalCaptchaUrl);
    await verifySignalRegistrationCode(botPhone, verificationCode);
    await setSignalProfileName();
    await Message.send_to_admins(community_id, null, 'Rhizal has been initialized. You can now start the bot by using "npm start".');
    console.log('Setup complete! You should receive a message from Rhizal shortly. Please use "npm start" to start the bot.');
}

initialize().catch(console.error);