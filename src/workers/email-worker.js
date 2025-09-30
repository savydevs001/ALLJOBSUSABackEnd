import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";
import IORedis from "ioredis";
import nodemailer from "nodemailer";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import { getTermsUpdateTemplate } from "../utils/email-templates.js";
import connectToDatabase from "../database/index.js";

const { EMAIL_CLIENT, FRONTEND_URL, EMAIL_PASS } = process.env;
if (!EMAIL_CLIENT || !FRONTEND_URL || !EMAIL_PASS) {
  console.error("Some of variables missing for email sender (nodemailer)");
  process.exit(0);
}

// mongodb connection
connectToDatabase();

// redis connection
const redisConnection = new IORedis({ maxRetriesPerRequest: null });
const batchSize = 500;

// nodemailer tranporter
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com", // Hostinger SMTP
  port: 465, // SSL
  secure: true, // true = 465, false = 587
  auth: {
    user: EMAIL_CLIENT,
    pass: EMAIL_PASS,
  },
});

// delay function
const delayFunction = async (secs) => {
  await new Promise((resolve) => setTimeout(resolve, secs));
};

const worker = new Worker(
  "email-queue",
  async (job) => {
    console.log(`Processing job: ${job.id} - ${job.name}`);
    try {

      // On Change in Policy
      if (job.name === "send-policy-update") {
        const userCollections = [JOBSEEKER, EMPLOYER, FREELANCER];

        let totalEmailsSent = 0;
        const policyUpdateEmailTemplate = getTermsUpdateTemplate({
          title: "Policy Updated",
          buttonText: "View Policy",
          buttonUrl: FRONTEND_URL + "/policy",
          message:
            "Our Policy had been updated, Please read our new Policy in oder to keep yourself updated of what we are heading to",
        });

        // loop throgh each collection
        for (const collection of userCollections) {
          console.log(
            `--- Starting to process collection for policy update: ${collection.modelName || "Unknown"
            } ---`
          );

          let cursor = 0;
          let users;

          do {
            users = await collection
              .find({})
              .select({ email: 1 })
              .sort({ createdAt: 1 })
              .skip(cursor)
              .limit(batchSize);
            for (const user of users) {
              try {
                const mailOptions = {
                  from: `"ALLJOBSUSA" <${EMAIL_CLIENT}>`,
                  to: user.email,
                  subject: "Policy Updated",
                  html: policyUpdateEmailTemplate,
                };
                await transporter.sendMail(mailOptions);
                totalEmailsSent += 1;
              } catch (err) {
                console.error(`Failed to send email to ${user.email}`, err);
              }
              await delayFunction(0.1);
            }
            cursor += batchSize;
          } while (users.length == batchSize);
        }

        console.log("Policy Update Email sent: ", totalEmailsSent);
      }

      // On Change in Terms
      if (job.name === "send-terms-update") {
        const userCollections = [JOBSEEKER, EMPLOYER, FREELANCER];

        let totalEmailsSent = 0;
        const policyUpdateEmailTemplate = getTermsUpdateTemplate({
          title: "Terms Updated",
          buttonText: "View Terms",
          buttonUrl: FRONTEND_URL + "/policy?section=terms",
          message:
            "Our Terms had been updated, Please read our new terms in oder to keep yourself updated of what we are heading to and avoid any disturbance",
        });

        // loop throgh each collection
        for (const collection of userCollections) {
          console.log(
            `--- Starting to process collection for terms updates: ${collection.modelName || "Unknown"
            } ---`
          );
          let cursor = 0;
          let users;

          do {
            users = await collection
              .find({})
              .select({ email: 1 })
              .sort({ createdAt: 1 })
              .skip(cursor)
              .limit(batchSize);
            for (const user of users) {
              try {
                const mailOptions = {
                  from: `"ALLJOBSUSA" <${EMAIL_CLIENT}>`,
                  to: user.email,
                  subject: "Terms Updated",
                  html: policyUpdateEmailTemplate,
                };
                await transporter.sendMail(mailOptions);
                totalEmailsSent += 1;
              } catch (err) {
                console.error(`Failed to send email to ${user.email}`, err);
              }
              await delayFunction(0.1);
            }
            cursor += batchSize;
          } while (users.length == batchSize);
        }

        console.log("Terms Update Emails sent: ", totalEmailsSent);
      }

      // on change of rules
      if (job.name === "send-rules-update") {
        const userCollections = [JOBSEEKER, EMPLOYER, FREELANCER];

        let totalEmailsSent = 0;
        const policyUpdateEmailTemplate = getTermsUpdateTemplate({
          title: "Rules Updated",
          buttonText: "View Rules",
          buttonUrl: FRONTEND_URL + "/policy?section=rules",
          message:
            "Our Rules had been updated, Please read our new new in oder to keep yourself updated of what we are heading to and avoid any disturbance",
        });

        // loop throgh each collection
        for (const collection of userCollections) {
          console.log(
            `--- Starting to process collection for terms updates: ${collection.modelName || "Unknown"
            } ---`
          );
          let cursor = 0;
          let users;

          do {
            users = await collection
              .find({})
              .select({ email: 1 })
              .sort({ createdAt: 1 })
              .skip(cursor)
              .limit(batchSize);
            for (const user of users) {
              try {
                const mailOptions = {
                  from: `"ALLJOBSUSA" <${EMAIL_CLIENT}>`,
                  to: user.email,
                  subject: "Rules Updated",
                  html: policyUpdateEmailTemplate,
                };
                await transporter.sendMail(mailOptions);
                totalEmailsSent += 1;
              } catch (err) {
                console.error(`Failed to send email to ${user.email}`, err);
              }
              await delayFunction(0.1);
            }
            cursor += batchSize;
          } while (users.length == batchSize);
        }

        console.log("Terms Update Emails sent: ", totalEmailsSent);
      }

      // change of cookies
      if (job.name === "send-cookies-update") {
        const userCollections = [JOBSEEKER, EMPLOYER, FREELANCER];

        let totalEmailsSent = 0;
        const cookiesUpdateEmailTemplate = getTermsUpdateTemplate({
          title: "Cookies Updated",
          buttonText: "View Cookies",
          buttonUrl: FRONTEND_URL + "/policy?section=cookies",
          message:
            "We are updating our cookies policy, Please review our new policy to stay up-to-date",
        });

        // loop throgh each collection
        for (const collection of userCollections) {
          console.log(
            `--- Starting to process collection for policy updates: ${collection.modelName || "Unknown"
            } ---`
          );
          let cursor = 0;
          let users;

          do {
            users = await collection
              .find({})
              .select({ email: 1 })
              .sort({ createdAt: 1 })
              .skip(cursor)
              .limit(batchSize);
            for (const user of users) {
              try {
                const mailOptions = {
                  from: `"ALLJOBSUSA" <${EMAIL_CLIENT}>`,
                  to: user.email,
                  subject: "Cookies Updated",
                  html: cookiesUpdateEmailTemplate,
                };
                await transporter.sendMail(mailOptions);
                totalEmailsSent += 1;
              } catch (err) {
                console.error(`Failed to send email to ${user.email}`, err);
              }
              await delayFunction(0.1);
            }
            cursor += batchSize;
          } while (users.length == batchSize);
        }

        console.log("Cookies Update Emails sent: ", totalEmailsSent);
      }

      // simple mails
      if (job.name == "simple-mail") {
        const data = job.data;
        const mailOptions = {
          from: `"ALLJOBSUSA" <${EMAIL_CLIENT}>`,
          to: data.to,
          subject: data.subject,
          html: data.html,
        };
        await transporter.sendMail(mailOptions);
      }
    }
    catch (err) {
      console.log("Error executin email job: ", err)
    }
  },
  { connection: redisConnection, concurrency: 15 }
);

console.log("Worker is listening for jobs...");

worker.on("completed", async (job) => {
  console.log(`Job ${job.id} has completed!`);
  try {
    await job.remove();
  } catch (err) {
    console.error(`Failed to remove job ${job.id}:`, err);
  }
});

worker.on("failed", async (job, err) => {
  console.log(`Job ${job.id} has failed with ${err.message}`);
});
