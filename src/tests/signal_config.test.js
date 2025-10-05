const fs = require('fs');
const readline = require('readline');
const yaml = require('js-yaml');

jest.mock('fs');
jest.mock('readline');
jest.mock('js-yaml');

const signalConfig = require('../initialization/signal_config');

describe('signal_config.js', () => {
    let rlMock;
    beforeEach(() => {
        rlMock = {
            question: jest.fn(),
            close: jest.fn()
        };
        readline.createInterface.mockReturnValue(rlMock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('promptSignalCaptchaUrl', () => {


        it('should prompt the user and resolve with the trimmed URL', async () => {
            const userInput = ' sgnl://test-url ';
            rlMock.question.mockImplementation((prompt, cb) => cb(userInput));

            const promise = signalConfig.promptSignalCaptchaUrl();

            // Simulate async readline
            const result = await promise;
            expect(result).toBe('sgnl://test-url');
            expect(readline.createInterface).toHaveBeenCalled();
            expect(rlMock.close).toHaveBeenCalled();
        });
    });

    describe('getVerificationCodeFromSignalCaptchaUrl', () => {
        let rlMock;
        beforeEach(() => {
            rlMock = {
                question: jest.fn(),
                close: jest.fn()
            };
            readline.createInterface.mockReturnValue(rlMock);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should successfully get verification code after POST', async () => {
            // Mock HTTP POST
            const http = require('http');
            const reqMock = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn()
            };
            const resMock = {
                statusCode: 200,
                on: jest.fn()
            };
            http.request = jest.fn((opts, cb) => {
                setImmediate(() => {
                    cb(resMock);
                    resMock.on.mock.calls.forEach(([event, handler]) => {
                        if (event === 'data') handler('');
                        if (event === 'end') handler();
                    });
                });
                return reqMock;
            });

            // Simulate readline for verification code
            const codeInput = ' 987654 ';
            rlMock.question.mockImplementation((prompt, cb) => cb(codeInput));
            resMock.on.mockImplementation((event, handler) => {});

            const result = await signalConfig.getVerificationCodeFromSignalCaptchaUrl('+123', 'sgnl://captcha-url');
            expect(result).toBe('987654');
            expect(http.request).toHaveBeenCalled();
            expect(rlMock.close).toHaveBeenCalled();
        });

        it('should POST to signal-cli and prompt for verification code', async () => {
            // Setup config
            fs.readFileSync.mockReturnValue('community: { bot_phone: "+123" }');
            yaml.load.mockReturnValue({ community: { bot_phone: '+123' } });

            // Mock HTTP POST
            const http = require('http');
            const reqMock = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn()
            };
            const resMock = {
                statusCode: 200,
                on: jest.fn()
            };
            http.request = jest.fn((opts, cb) => {
                // Simulate response
                setImmediate(() => {
                    cb(resMock);
                    // Simulate data and end events
                    resMock.on.mock.calls.forEach(([event, handler]) => {
                        if (event === 'data') handler('');
                        if (event === 'end') handler();
                    });
                });
                return reqMock;
            });

            // Simulate readline for verification code
            const codeInput = ' 123456 ';
            let codePrompted = false;
            rlMock.question.mockImplementation((prompt, cb) => {
                codePrompted = true;
                cb(codeInput);
            });

            // Simulate res.on
            resMock.on.mockImplementation((event, handler) => {
                // handled above in setImmediate
            });

            const result = await signalConfig.getVerificationCodeFromSignalCaptchaUrl('sgnl://test');
            expect(result).toBe('123456');
            expect(codePrompted).toBe(true);
            expect(http.request).toHaveBeenCalled();
            expect(rlMock.close).toHaveBeenCalled();
        });

        it('should reject if POST to signal-cli fails', async () => {
            fs.readFileSync.mockReturnValue('community: { bot_phone: "+123" }');
            yaml.load.mockReturnValue({ community: { bot_phone: '+123' } });

            const http = require('http');
            const reqMock = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn()
            };
            const resMock = {
                statusCode: 400,
                on: jest.fn()
            };
            http.request = jest.fn((opts, cb) => {
                setImmediate(() => {
                    cb(resMock);
                    resMock.on.mock.calls.forEach(([event, handler]) => {
                        if (event === 'data') handler('fail');
                        if (event === 'end') handler();
                    });
                });
                return reqMock;
            });
            resMock.on.mockImplementation((event, handler) => {});

            await expect(signalConfig.getVerificationCodeFromSignalCaptchaUrl('sgnl://test')).rejects.toThrow(
                /Failed to register/
            );
        });
    });

    describe('verifySignalRegistrationCode', () => {
        let rlMock;
        beforeEach(() => {
            rlMock = {
                question: jest.fn(),
                close: jest.fn()
            };
            readline.createInterface.mockReturnValue(rlMock);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should prompt for PIN and POST to signal-cli for verification', async () => {
            const https = require('http');
            const reqMock = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn()
            };
            const resMock = {
                statusCode: 200,
                on: jest.fn()
            };
            https.request = jest.fn((opts, cb) => {
                setImmediate(() => {
                    cb(resMock);
                    resMock.on.mock.calls.forEach(([event, handler]) => {
                        if (event === 'data') handler('');
                        if (event === 'end') handler();
                    });
                });
                return reqMock;
            });
            resMock.on.mockImplementation((event, handler) => {});

            const pinInput = ' 9999 ';
            rlMock.question.mockImplementation((prompt, cb) => cb(pinInput));

            await expect(signalConfig.verifySignalRegistrationCode('+123', '123456')).resolves.toBeUndefined();
            expect(https.request).toHaveBeenCalled();
            expect(rlMock.close).toHaveBeenCalled();
        });

        it('should reject if POST to signal-cli fails', async () => {
            const https = require('http');
            const reqMock = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn()
            };
            const resMock = {
                statusCode: 400,
                on: jest.fn()
            };
            https.request = jest.fn((opts, cb) => {
                setImmediate(() => {
                    cb(resMock);
                    resMock.on.mock.calls.forEach(([event, handler]) => {
                        if (event === 'data') handler('fail');
                        if (event === 'end') handler();
                    });
                });
                return reqMock;
            });
            resMock.on.mockImplementation((event, handler) => {});

            rlMock.question.mockImplementation((prompt, cb) => cb('1234'));

            await expect(signalConfig.verifySignalRegistrationCode('+123', '123456')).rejects.toThrow(
                /Failed to verify registration/
            );
        });
    });

    describe('setSignalProfileName', () => {
        beforeEach 
        it('should set the Signal profile name', async () => {
            fs.readFileSync.mockReturnValue('community: { bot_phone: "+123", signal_username: "rhizal" }');
            yaml.load.mockReturnValue({ community: { bot_phone: '+123', signal_username: 'rhizal' } });

            const http = require('http');
            const reqMock = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn()
            };
            const resMock = {
                statusCode: 200,
                on: jest.fn()
            };
            http.request = jest.fn((opts, cb) => {
                setImmediate(() => {
                    cb(resMock);
                    resMock.on.mock.calls.forEach(([event, handler]) => {
                        if (event === 'data') handler('{"username": "rhizal"}');
                        if (event === 'end') handler();
                    });
                });
                return reqMock;
            });
            resMock.on.mockImplementation((event, handler) => {});

            await expect(signalConfig.setSignalProfileName()).resolves.toBeUndefined();
            expect(http.request).toHaveBeenCalled();
        });
    });
});
