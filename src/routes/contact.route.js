import { Router } from "express";
import dotenv from "dotenv";
dotenv.config();
import enqueueEmail from "../services/emailSender.js";
import { z } from "zod";

const ContactRouter = Router();

const SUPPORT_EMAIL = process.env.SUPPORT_RECIEVE_EMAIL;
const FRONTEND_URL = process.env.FRONTEND_URL + "/"
const ADVERTIZE_EMAIL = "brightway@workspidusa.com"
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

const AdvertizeZodSchema = z.object({
  fName: z.string(),
  lName: z.string(),
  website: z.string(),
  email: z.string().email("Invalid Email Format"),
  phone: z.string(),
  company: z.string(),
  about: z.string(),
  canContact: z.coerce.boolean(),
  type: z.enum(["Weekly", "Monthly", "Quarterly", "Yearly"]),
});
ContactRouter.post("/advertise", async (req, res) => {
  try {
    const parsed = AdvertizeZodSchema.parse(req.body);

    const subject = `New Advertise Request - ${parsed.company}`;

    const htmlTemplate = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
          h2 { color: #1a4b78; }
          p { margin: 6px 0; }
          .label { font-weight: bold; color: #1a4b78; }
          .footer { margin-top: 20px; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; padding:4px; border-radius:6px;">
      <tr>
        <!-- Logo -->
        <td style="padding-right:8px; vertical-align:middle;">
          <img
            src="${FRONTEND_URL}logo.png"
            alt="WORKSPID Logo"
            width="40"
            height="40"
            style="display:block; border-radius:50%;"
          />
        </td>

        <!-- Brand text -->
        <td style="vertical-align:middle; font-family:Arial,Helvetica,sans-serif; font-weight:bold; font-size:20px; letter-spacing:0.05em; color:#1a4b78;">
          ALL<span style="color:#d30808;">JOBS</span>USA
        </td>
      </tr>
    </table>
    
          <h2>📢 New Advertisement Request</h2>
          <p><span class="label">First Name:</span> ${parsed.fName}</p>
          <p><span class="label">Last Name:</span> ${parsed.lName}</p>
          <p><span class="label">Company:</span> ${parsed.company}</p>
          <p><span class="label">Website:</span> <a href="${parsed.website
      }" target="_blank">${parsed.website}</a></p>
          <p><span class="label">Email:</span> <a href="mailto:${parsed.email
      }">${parsed.email}</a></p>
          <p><span class="label">Phone:</span> ${parsed.phone}</p>
          <p><span class="label">Ad Type:</span> ${parsed.type}</p>
          <p><span class="label">About Company:</span><br/> ${parsed.about.replace(
        /\n/g,
        "<br>"
      )}</p>
          <p><span class="label">Can Contact:</span> ${parsed.canContact ? "✅ Yes" : "❌ No"
      }</p>
          
          <div class="footer">
            This request was submitted via the Advertise With Us form WORKSPID.
          </div>
        </div>
      </body>
    </html>`;

    await enqueueEmail(ADVERTIZE_EMAIL, subject, htmlTemplate);

    res.status(200).json({ message: "We will contact you soon" });
  } catch (err) {
    console.log("❌ Error sending advertise email: ", err);
    res.status(500).json({ message: "Server Error" });
  }
});

export default ContactRouter;
