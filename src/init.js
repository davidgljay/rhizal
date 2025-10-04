const { load_sql_schema, upload_metadata, create_system } = require('./initialization/db_init');
const { update_community_and_scripts } = require('./initialization/script_sync');

async function initialize() {
    console.log('Initializing database');
    await load_sql_schema();
    console.log('Uploading metadata');
    await upload_metadata();
    console.log('Creating system');
    await create_system();
    console.log('Updating community and scripts');
    await update_community_and_scripts();
}

initialize().catch(console.error);