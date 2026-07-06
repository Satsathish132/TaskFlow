const nodemailer = require("nodemailer");

// --- Gmail SMTP setup ---
// 1. The Gmail account sending these must have 2-Step Verification enabled.
// 2. Generate an "App Password": Google Account -> Security -> 2-Step
//    Verification -> App passwords -> generate one for "Mail".
//    (Regular Gmail login passwords will NOT work here.)
// 3. Set these in your .env (never commit real values):
//      GMAIL_USER=youraddress@gmail.com
//      GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   (16-char app password, no spaces)
//      MAIL_FROM=youraddress@gmail.com
//      APP_URL=https://app.yoursite.com
//
// Note: Gmail SMTP is fine for testing or low volume, but Google caps
// sending (~500/day on a free account) and may throttle or flag bulk mail.
// For a public app with many users, a transactional provider (SES,
// SendGrid, Mailgun, Postmark) is the better long-term fit -- swap the
// transport config below when you're ready, the rest of this file stays
// the same.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendResetEmail(toEmail, resetUrl) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.GMAIL_USER,
    to: toEmail,
    subject: "Reset your password",
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 30 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

module.exports = { sendResetEmail };
