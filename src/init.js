const { load_sql_schema, upload_metadata, create_system } = require('./initialization/db_init');
const { update_community_and_scripts } = require('./initialization/script_sync');

async function initialize() {
    await load_sql_schema();
    await upload_metadata();
    await create_system();
    await update_community_and_scripts();
}

initialize().catch(console.error);