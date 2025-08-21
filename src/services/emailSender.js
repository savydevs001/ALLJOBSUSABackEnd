import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { google } from "googleapis";
dotenv.config();

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_CLIENT,
  EMAIL_PASS,
  // EMAIL_CLIENT_SECRET,
  // EMAIL_CLIENT_ID,
  // EMAIL_CLIENT_REFRESH_TOKEN,
  // EMAIL_CLIENT_REDIRECT_URL,
} = process.env;
if (
  !EMAIL_HOST ||
  !EMAIL_PORT ||
  !EMAIL_CLIENT ||
  !EMAIL_PASS
  // !EMAIL_CLIENT_SECRET ||
  // !EMAIL_CLIENT_ID ||
  // !EMAIL_CLIENT_REFRESH_TOKEN ||
  // !EMAIL_CLIENT_REDIRECT_URL
) {
  console.error("Some of variables missing for email sender (nodemailer)");
  process.exit(0);
}

// google client
// const oAuth2Client = new google.auth.OAuth2(
//   EMAIL_CLIENT_ID,
//   EMAIL_CLIENT_SECRET,
//   EMAIL_CLIENT_REDIRECT_URL
// );
// oAuth2Client.setCredentials({ refresh_token: EMAIL_CLIENT_REFRESH_TOKEN });

const getTransporter = async () => {
  // const accessToken = await oAuth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      // type: "OAuth2",
      user: EMAIL_CLIENT,
      pass: EMAIL_PASS,
      // clientId: EMAIL_CLIENT_ID,
      // clientSecret: EMAIL_CLIENT_SECRET,
      // refreshToken: EMAIL_CLIENT_REFRESH_TOKEN,
      // accessToken: accessToken.token,
    },
  });
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_CLIENT,
    pass: EMAIL_PASS,
  },
});

const emailQueue = [];

function enqueueEmail(to, subject, html) {
  emailQueue.push({ to, subject, html });
  console.log(`📥 Email queued for ${to}`);
}

setInterval(async () => {
  if (emailQueue.length === 0) return;

  const { to, subject, html } = emailQueue.shift();
  const mailOptions = {
    from: `"ALLJOBUSA" <${EMAIL_CLIENT}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent:", info.messageId);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
  }
}, 5000);

export default enqueueEmail;
