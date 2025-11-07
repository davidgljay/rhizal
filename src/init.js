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
    const bot_phone = community.bot_phone;
    const signal_captcha_url = await promptsignal_captcha_url();
    const verification_code = await getVerificationCodeFromsignal_captcha_url(bot_phone, signal_captcha_url);
    await verifySignalRegistrationCode(bot_phone, verification_code);
    const rhizal_username = await setSignalProfileName();
    const {admin_phone, admin_id} = await set_admin(community, rhizal_username);
    console.log('Setting up access groups');
    await init_access_groups(community, admin_phone);
    await Message.send(community.id, admin_id, admin_phone, bot_phone, 'Rhizal has been set up! You should have been invited as an admin to the groups specified in the community_config.yml file.');
    await Message.send(community.id, admin_id, admin_phone, bot_phone, 'You can add and remove members from these groups to grant and revoke permissions.');
    console.log('Setup complete! You should receive a message from Rhizal shortly. Please use "npm start" to start the bot.');
}
initialize().catch(console.error);