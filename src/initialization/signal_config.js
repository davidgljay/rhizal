const fs = require('fs');
const yaml = require('js-yaml');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const path = require('path');

async function promptSignalCaptchaUrl() {
    console.log("================================================");
    console.log("To register your Signal account, please follow these steps:");
    console.log("");
    console.log("1. Go to the following URL in your browser: https://signalcaptchas.org/registration/generate.html");
    console.log("");
    console.log("2. Complete the captcha on the page.");
    console.log("");
    console.log('3. Right click on "Open Signal" and copy the URL (it should start with "signalcaptcha://").');
    console.log("");
    console.log("4. Paste the copied URL below and press Enter.");

    return await new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question("Paste the Signal registration URL here: ", (url) => {
            rl.close();
            resolve(url.trim());
        });
    });
}

async function getVerificationCodeFromSignalCaptchaUrl(botphone, signalCaptchaUrl) {

    // Prepare the POST request to http://signal-cli:8080
    const postData = JSON.stringify({ captcha: signalCaptchaUrl, use_voice: false });

    await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'signal-cli',
            port: 8080,
            path: `/v1/register/${encodeURIComponent(botphone)}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Failed to register: ${res.statusCode} ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });


    // Prompt user for verification code
    console.log("You should receive a verification code at the number that you want to use as a Signal bot for Rhizal. Please enter it here:");
    return await new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question("Verification code: ", (code) => {
            rl.close();
            resolve(code.trim());
        });
    });
}

async function verifySignalRegistrationCode(botPhone, verificationCode) {
    // Prompt user to define a PIN
    console.log("You must define a PIN for your Signal bot. This PIN is required for registration and should be saved in a secure place.");
    const readline = require('readline');
    const userPin = await new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });
        rl.question("Please enter a new PIN for your Signal bot: ", (pin) => {
            rl.close();
            resolve(pin.trim());
        });
    });

    // Prepare the POST request to verify the registration code
    const verifyUrl = `http://signal-cli:8080/v1/register/${botPhone}/verify/${encodeURIComponent(verificationCode)}`;
    const parsedUrl = new URL(verifyUrl);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const postData = JSON.stringify({ pin: userPin });

    await new Promise((resolve, reject) => {
        const req = lib.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log("Signal registration verified successfully.");
                    resolve();
                } else {
                    reject(new Error(`Failed to verify registration: ${res.statusCode} ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function setSignalProfileName() {
    // Load community config
    const configPath = path.join(__dirname, '../../scripts_config/community_config.yml');
    let configContent;
    try {
        configContent = fs.readFileSync(configPath, 'utf8');
    } catch (err) {
        throw new Error(`Failed to read community config: ${err.message}`);
    }

    // Simple YAML parsing for bot_phone, signal_username, and signal_profile_name
    const botPhoneMatch = configContent.match(/bot_phone:\s*["']?([^\n"']+)["']?/);
    const usernameMatch = configContent.match(/signal_username:\s*["']?([^\n"']+)["']?/);
    const profileNameMatch = configContent.match(/signal_profile_name:\s*["']?([^\n"']+)["']?/);

    if (!botPhoneMatch || !usernameMatch || !profileNameMatch) {
        throw new Error("Could not find bot_phone, signal_username, or signal_profile_name in community_config.yml");
    }

    const botPhone = botPhoneMatch[1].trim();
    const username = usernameMatch[1].trim();
    const profileName = profileNameMatch[1].trim();
    console.log('Setting Signal username to:', username);
    console.log('Setting Signal profile name to:', profileName);

    const postData = JSON.stringify({ username });

    const urlPath = `/v1/accounts/${botPhone}/username`;


    await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'signal-cli',
            port: 8080,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(data);
                    console.log(JSON.parse(data));
                    console.log("Signal username set successfully, assigned username:", JSON.parse(data).username);
                    resolve();
                } else {
                    reject(new Error(`Failed to set Signal username: ${res.statusCode} ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });

    // Now set the profile name
    const profileData = JSON.stringify({ name: profileName });
    const profilePath = `/v1/profiles/${botPhone}`;

    await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'signal-cli',
            port: 8080,
            path: profilePath,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(profileData)
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log("Signal profile name set successfully to:", profileName);
                    resolve();
                } else {
                    reject(new Error(`Failed to set Signal profile name: ${res.statusCode} ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(profileData);
        req.end();
    });
}




module.exports = {
    promptSignalCaptchaUrl,
    getVerificationCodeFromSignalCaptchaUrl,
    verifySignalRegistrationCode,
    setSignalProfileName
}