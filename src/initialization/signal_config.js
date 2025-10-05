const fs = require('fs');
const yaml = require('js-yaml');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const path = require('path');

async function promptSignalCaptchaUrl() {
    console.log("To register your Signal account, please follow these steps:");
    console.log("1. Go to the following URL in your browser: https://signalcaptchas.org/registration/generate.html");
    console.log("2. Complete the captcha on the page.");
    console.log('3. Right click on "Open Signal" and copy the URL (it should start with "sgnl://").');
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

async function getVerificationCodeFromSignalCaptchaUrl(signalCaptchaUrl) {
    // Read community_config.yml to get bot_phone
    let botPhone;
    try {
        const configContent = fs.readFileSync('community_config.yml', 'utf8');
        const config = yaml.load(configContent);
        botPhone = config.community && config.community.bot_phone;
        if (!botPhone) {
            throw new Error("bot_phone not found in community_config.yml");
        }
    } catch (err) {
        throw new Error("Failed to read bot_phone from community_config.yml: " + err.message);
    }

    // Prepare the POST request to http://signal-cli:8080
    const registerUrl = `http://signal-cli:8080/v1/register/${encodeURIComponent(botPhone)}`;
    const parsedUrl = new URL(registerUrl);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const postData = JSON.stringify({ captcha: signalCaptchaUrl });

    await new Promise((resolve, reject) => {
        const req = lib.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
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
    const verifyUrl = `http://signal-cli:8080/v1/register/${encodeURIComponent(botPhone)}/verify/${encodeURIComponent(verificationCode)}`;
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

    // Simple YAML parsing for bot_phone and signal_username
    const botPhoneMatch = configContent.match(/bot_phone:\s*["']?([^\n"']+)["']?/);
    const usernameMatch = configContent.match(/signal_username:\s*["']?([^\n"']+)["']?/);

    if (!botPhoneMatch || !usernameMatch) {
        throw new Error("Could not find bot_phone or signal_username in community_config.yml");
    }

    const botPhone = botPhoneMatch[1].trim();
    const username = usernameMatch[1].trim();

    const postData = JSON.stringify({ username });

    const urlPath = `/v1/accounts/${encodeURIComponent(botPhone)}/username`;

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
            let response = {}
            res.on('data', chunk => {
                if (response.body === null) response.body = '';
                response.body += chunk;
            });
            res.on('end', () => {
                response.statusCode = res.statusCode;
                response.headers = res.headers;
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log("Signal profile name set successfully, you have been assigned the username: " + response.body.username);
                    resolve();
                } else {
                    console.log(response);
                    reject(new Error(`Failed to set Signal profile name: ${res.statusCode} ${response.body}`));
                }
            });
        });
        req.on('error', reject);
        let response = {
            statusCode: null,
            headers: null,
            body: null
        };
        

        req.write(postData);
        req.end();
    });
}




module.exports = {
    promptSignalCaptchaUrl,
    getVerificationCodeFromSignalCaptchaUrl,
    verifySignalRegistrationCode,
    setSignalProfileName
}