const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

async function generateTwoFactorSecret(userEmail) {
  const secret = speakeasy.generateSecret({ name: `Taskflow (${userEmail})` });
  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  return { base32Secret: secret.base32, qrDataUrl };
}

function verifyTwoFactorToken(base32Secret, token) {
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: "base32",
    token,
    window: 1,
  });
}

module.exports = { generateTwoFactorSecret, verifyTwoFactorToken };