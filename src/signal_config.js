const { promptSignalCaptchaUrl, getVerificationCodeFromSignalCaptchaUrl, verifySignalRegistrationCode, setSignalProfileName } = require('./initialization/signal_config');

async function configure_signal() {
    const signalCaptchaUrl = await promptSignalCaptchaUrl();
    const verificationCode = await getVerificationCodeFromSignalCaptchaUrl(signalCaptchaUrl);
    await verifySignalRegistrationCode(verificationCode);
    await setSignalProfileName();
}

configure_signal().catch(console.error);