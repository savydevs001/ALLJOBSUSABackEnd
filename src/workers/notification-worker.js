import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import IORedis from "ioredis";
import EMPLOYER from "../database/models/employers.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import { sendMobileNotification } from "../config/firebase.js";
import connectToDatabase from "../database/index.js";
import { getMessageEmailTemplate } from "../utils/email-templates.js";

const APP_NAME = "WORKSPID"

const { EMAIL_CLIENT, EMAIL_PASS } = process.env;

// mongodb connection
connectToDatabase();

// redis connection
const redisConnection = new IORedis({ maxRetriesPerRequest: null });

const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com", // Hostinger SMTP
    port: 465, // SSL
    secure: true, // true = 465, false = 587
    auth: {
        user: EMAIL_CLIENT,
        pass: EMAIL_PASS,
    },
    // logger: true
});

async function findReceiverById(receiverId) {
    try {
        let user =
            (await EMPLOYER.findById(receiverId).select({ fcm_token: 1, email: 1 })) ||
            (await JOBSEEKER.findById(receiverId).select({ fcm_token: 1, email: 1 })) ||
            (await FREELANCER.findById(receiverId).select({ fcm_token: 1, email: 1 }));

        return user;
    } catch (err) {
        return null;
    }
}

const worker = new Worker(
    "workspid-notification-queue",
    async (job) => {
        console.log(`Processing Notification job: ${job.id} - ${job.name}`);

        try {
            switch (job.name) {
                case "chat-fcm-notification": {
                    const data = job.data;

                    const receiver = await findReceiverById(data.receiverId);
                    if (!receiver) return;

                    const bodyMessage = data.offerId
                        ? "New Offer Received"
                        : data.meetingId
                            ? "New Meeting Proposed"
                            : data.message;

                    /* ------------------ FCM ------------------ */
                    if (receiver.fcm_token) {
                        await sendMobileNotification(
                            receiver.fcm_token,
                            "New Message",
                            bodyMessage,
                            { message: JSON.stringify(data) }
                        );
                    }

                    /* ------------------ EMAIL ------------------ */
                    if (receiver.email) {
                        console.log("Mail: ", receiver.email)
                        const messageHtml = getMessageEmailTemplate({
                            // senderName: "New *",
                            message: data.message,
                            meetingId: data.meetingId,
                            offerId: data.offerId,
                            conversationId: data.senderId,
                        })
                        const mailOptions = {
                            from: `"${APP_NAME}" <${EMAIL_CLIENT}>`,
                            to: receiver.email,
                            subject: bodyMessage,
                            html: messageHtml,
                        };

                        await transporter.sendMail(mailOptions);
                    }

                    break;
                }

                case "support-chat-fcm-notification": {
                    const data = job.data;
                    const receiver = await findReceiverById(data.receiverId);
                    if (!receiver) return;

                    if (receiver.fcm_token) {
                        await sendMobileNotification(
                            receiver.fcm_token,
                            "Support Message",
                            data.message,
                            { supportMessage: JSON.stringify(data) }
                        );
                    }

                    break;
                }

                default:
                    console.log("Unknown job type:", job.name);
            }
        } catch (err) {
            console.error("Error executing notification job:", err);
        }
    },
    {
        connection: redisConnection,
        concurrency: 10,
    }
);



console.log("Notification Worker is listening for jobs...");

worker.on("completed", async (job) => {
    console.log(`Job ${job.id} has completed!`);
    try {
        await job.remove();
    } catch (err) {
        console.error(`Failed to remove job ${job.id}:`, err);
    }
});

worker.on("failed", (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
});