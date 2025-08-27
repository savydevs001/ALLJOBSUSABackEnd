import { Router } from "express";
import dotenv from "dotenv";
dotenv.config();
import enqueueEmail from "../services/emailSender.js";

const ContactRouter = Router();

const SUPPORT_EMAIL = process.env.SUPPORT_RECIEVE_EMAIL;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

ContactRouter.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const data = { name, email, subject, message };
    if (!data.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    if (!data.email.trim()) {
      toast.error("Email is required.");
      return;
    } else if (!EMAIL_REGEX.test(data.email)) {
      toast.error("Email address is invalid.");
      return;
    }

    if (!data.subject.trim()) {
      toast.error("Subject is required.");
      return;
    } else if (data.subject.trim().length < 5) {
      toast.error("Subject must be at least 5 characters long.");
      return;
    }

    if (!data.message.trim()) {
      toast.error("Message is required.");
      return;
    } else if (data.message.trim().length < 10) {
      toast.error("Message must be at least 10 characters long.");
      return;
    }

    await enqueueEmail(
      SUPPORT_EMAIL,
      subject,
      `<!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <h2>New Support Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      </body>
    </html>`
    );
    res.status(200).json({ message: "We will contact you soon" });
  } catch (err) {
    console.log("❌ Error sending contact email: ", err);
    res.status(500).json({ message: "Server Error" });
  }
});

export default ContactRouter;
