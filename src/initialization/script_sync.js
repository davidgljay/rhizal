const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Community = require('../models/community');
const Script = require('../models/script');

async function initial_message() {
    console.log("Thank you for trying out Rhizal!");
    console.log("This initialization script will set up Rhizal's data stores and configure settings for your organization.");
    console.log("In the /scripts_config directory there are a series of yaml files. Most of them are scripts, you can modify them to modify how Rhizal will respond as people engage with it. See the documentation on Github for more information.");
    console.log("There is also a file called community_config.yml. This Includes information about your organization and the number that Rhizal will use to establish a Signal account.");
    console.log("Please edit this file to set a number where you can receive text messages. It should NOT be a number already associated with an account on Signal, as this could wind up disrupting your other communications.");
    console.log("Once you have saved this file with a proper number and other information, press any key to continue.");

    await new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve();
        });
    });
}


const create_or_update_community = async function () {
    const community_config_yaml = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'community_config.yml'), 'utf8');
    let community_config;
    try {
        community_config = yaml.load(community_config_yaml).community;
    } catch (error) {
        console.error('Error loading community config yaml:', error);
        throw new Error('Error loading community config yaml');
    }
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
    const onboarding_script_yaml = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'onboarding.yml'), 'utf8');
    let onboarding_script;
    try {
        onboarding_script = yaml.load(onboarding_script_yaml);
    } catch (error) {
        console.error('Error loading onboarding script yaml:', error);
        throw new Error('Error loading onboarding script yaml');
    }
    const onboarding_script_config = {
        name: 'onboarding',
        community_id: community.id,
        script_json: JSON.stringify(onboarding_script)
    };
    const onboarding_script_result = await create_or_update_script(onboarding_script_config);
    const group_script_yaml = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'group_thread.yml'), 'utf8');
    let group_script;
    try {
        group_script = yaml.load(group_script_yaml);
    } catch (error) {
        console.error('Error loading group script yaml:', error);
        throw new Error('Error loading group script yaml');
    }
    const group_script_config = {
        name: 'group_thread',
        community_id: community.id,
        script_json: JSON.stringify(group_script)
    };
    const group_script_result = await create_or_update_script(group_script_config);
    console.log('Community and scripts updated');
    console.log('Community config:', community);
    console.log('Onboarding script id:', onboarding_script_result.id);
    console.log('Group script id:', group_script_result.id);
}

module.exports = {
    initial_message,
    update_community_and_scripts,
    create_or_update_community,
    create_or_update_script
}

