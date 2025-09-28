const { load_sql_schema, upload_metadata, create_system } = require('./initialization/db_init');
const { update_community_and_scripts } = require ('./initialization/script_sync');

load_sql_schema();
upload_metadata();
create_system();
update_community_and_scripts();