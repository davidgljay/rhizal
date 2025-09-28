const fs = require('fs');
const path = require('path');
const Community = require('../models/community');
const Script = require('../models/script');

const create_or_update_community = async function () {
    const community_config = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'community_config.yml'), 'utf8');
    const community = await Community.get(community_config.bot_phone);
    if (community) {
        return await Community.update(community_config);
    } else {
        return await Community.create(community_config);
    }
}

const create_or_update_script = async function (script_config) {
    const script = await Script.get(script_config.name);
    if (script) {
        return await Script.update(script_config);
    } else {
        return await Script.create(script_config);
    }
}

const update_community_and_scripts = async function () {
    const community = await create_or_update_community();
    const onboarding_script = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'onboarding.yml'), 'utf8');
    const onboarding_script_config = {
        name: 'onboarding',
        community_id: community.id,
        script_json: onboarding_script
    };
    const onboarding_script_result = await create_or_update_script(onboarding_script_config);
    const group_script = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'group_thread.yml'), 'utf8');
    const group_script_config = {
        name: 'group_thread',
        community_id: community.id,
        script_json: group_script
    };
    const group_script_result = await create_or_update_script(group_script_config);
    console.log('Community and scripts updated');
    console.log(community);
    console.log(onboarding_script_result);
    console.log(group_script_result);
}

module.exports = {
    update_community_and_scripts,
    create_or_update_community,
    create_or_update_script
}

