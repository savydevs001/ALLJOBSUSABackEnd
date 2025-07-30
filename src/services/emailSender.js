import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

let testAccount = await nodemailer.createTestAccount();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === 465, // true for 465, false for other ports
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASS,
  //   },
  auth: {
    user: testAccount.user,
    pass: testAccount.pass,
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
    from: `"ALLJOBUSA" <${process.env.EMAIL_USER}>`,
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
