const { promptSignalCaptchaUrl, getVerificationCodeFromSignalCaptchaUrl, verifySignalRegistrationCode } = require('./initialization/signal_config');

async function configure_signal() {
    const signalCaptchaUrl = await promptSignalCaptchaUrl();
    const verificationCode = await getVerificationCodeFromSignalCaptchaUrl(signalCaptchaUrl);
    await verifySignalRegistrationCode(verificationCode);
}

configure_signal().catch(console.error);