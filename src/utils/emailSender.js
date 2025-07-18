import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// let testAccount = await nodemailer.createTestAccount();


const transporter = nodemailer.createTransport({
  // host: process.env.EMAIL_HOST,
  // port: process.env.EMAIL_PORT,
  // secure: process.env.EMAIL_PORT === 465, // true for 465, false for other ports
  // //   auth: {
  // //     user: process.env.EMAIL_USER,
  // //     pass: process.env.EMAIL_PASS,
  // //   },
  // auth: {
  //   user: testAccount.user,
  //   pass: testAccount.pass,
  // },
});

const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: `"ALLJOBUSA" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw new Error(error.message || "Failed to send email");
  }
};

export default sendEmail;
