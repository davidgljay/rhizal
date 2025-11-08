const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Community = require('../models/community');
const Script = require('../models/script');
const readline = require('readline');
const Membership = require('../models/membership');
const Message = require('../models/message');
const GroupThread = require('../models/group_thread');
const WebSocket = require('ws');

async function initial_message() {
    console.log("Thank you for trying out Rhizal!");
    console.log("");
    console.log("This initialization script will set up Rhizal's data stores and configure settings for your organization.");
    console.log("");
    console.log("In the /scripts_config directory there are a series of yaml files. Most of them are scripts, you can modify them to modify how Rhizal will respond as people engage with it. See the documentation on Github for more information.");
    console.log("");
    console.log("There is also a file called community_config.yml. This Includes information about your organization and the number that Rhizal will use to establish a Signal account.");
    console.log("");
    console.log("Please edit this file to set a number where you can receive text messages. It should NOT be a number already associated with an account on Signal, as this could wind up disrupting your other communications.");
    console.log("");
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

const get_community_config = function () {
    const community_config_yaml = fs.readFileSync(path.join(__dirname, '../../scripts_config', 'community_config.yml'), 'utf8');
    let community_config;
    try {
        community_config = yaml.load(community_config_yaml).community;
    } catch (error) {
        console.error('Error loading community config yaml:', error);
        throw new Error('Error loading community config yaml');
    }
    return community_config;
}


const create_or_update_community = async function () {
    const community_config = get_community_config();
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
    await Community.update_community_scripts(community.id, onboarding_script_result.id, group_script_result.id);
    console.log('Community and scripts updated');
    return community;
}

const set_admin = async function (community, rhizal_username) {
    // Ask for a phone number to be entered via the console that will serve as an administrator for Rhizal.
    let admin_phone = await new Promise((resolve, reject) => {

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        console.log("================================================");
        console.log("Please enter a phone number to set as administrator for Rhizal.");
        console.log("Include the country code with no punctuation (e.g. +1234567890).");
        console.log("This number will be notified when new people register and will be able to assign roles to others.");
        console.log("================================================");

        rl.question('Please enter a phone number: ', (phone) => {
            rl.close();
            if (!phone || !phone.trim()) {
                console.error('No phone number entered.');
                return reject(new Error('No phone number entered.'));
            }
            resolve(phone.trim());
        });
    });
    let admin_name = await new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Ocassionally Rhizal will refer to you by name to others. What name would you like to use? ', (name) => {
            rl.close();
            if (!name || !name.trim()) {
                console.error('No name entered.');
                return reject(new Error('No name entered.'));
            }
            resolve(name.trim());
        });
    });
    console.log('Please send a signal message to username: ' + rhizal_username + ' to be added as an admin.');
    const admin_membership = await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://signal-cli:8080/v1/receive/' + community.bot_phone);
        ws.on('message', async (data) => {
            const message = JSON.parse(data);
            if (!message.envelope.dataMessage) {
                return;
            }
            const admin_phone = message.envelope.sourceUuid;
            const admin_membership = await Membership.create_admin(admin_phone, community);
            ws.close();
            resolve(admin_membership);
        });
        ws.on('error', (err) => {
            reject(new Error('WebSocket error:', err));
        });
    });

    console.log('Admin membership created with id:', admin_membership.id);
    console.log('Admin name set to:', admin_name);
    // Set the variable via Membership.set_variable
    await Membership.set_variable(admin_membership.id, "name", admin_name);
    return {admin_phone, admin_id: admin_membership.id};
}

const init_access_groups = async function (community, admin_phone) {
    const community_config = get_community_config();

    for (const role_name of Object.keys(community_config.access_levels)) {
        const group_name = `${community.name} rhizal ${role_name}`
        console.log(`Creating ${role_name} group: ${group_name}`);
        try {
            await GroupThread.create_group_and_invite(
                group_name, 
                community.bot_phone, 
                admin_phone,
                community_config.access_levels[role_name],
                community,
                true,
                role_name
            );
        } catch (error) {
            console.error('Error creating group:', error);
            break;
        }
    }
}

module.exports = {
    initial_message,
    update_community_and_scripts,
    create_or_update_community,
    create_or_update_script,
    init_access_groups,
    set_admin
}

