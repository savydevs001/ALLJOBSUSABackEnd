import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";
import IORedis from "ioredis";
import EMPLOYER from "../database/models/employers.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import { sendMobileNotification } from "../config/firebase.js";
import connectToDatabase from "../database/index.js";


// mongodb connection
connectToDatabase();

// redis connection
const redisConnection = new IORedis({ maxRetriesPerRequest: null });

async function findReceiverFCMToken(receiverId) {
    try {
        let user =
            (await EMPLOYER.findById(receiverId).select({ fcm_token: 1 })) ||
            (await JOBSEEKER.findById(receiverId).select({ fcm_token: 1 })) ||
            (await FREELANCER.findById(receiverId).select({ fcm_token: 1 }));

        if (user && user.fcm_token) {
            return user.fcm_token
        }

        return null;
    } catch (err) {
        return null;
    }
}


const worker = new Worker("workspid-notification-queue", async (job) => {
    console.log(`Processing Notification job: ${job.id} - ${job.name}`);

    try {
        switch (job.name) {
            case "chat-fcm-notification":
                const message = job.data
                const fcmToken = await findReceiverFCMToken(message.receiverId)
                if (fcmToken) {
                    const bodyMessage = message.offerId ? "New Offer received" : message.meetingId ? "New Meeting Proposed" : message.message
                    await sendMobileNotification(fcmToken, "Message", bodyMessage, { message: JSON.stringify(message) })
                }
                break

            case "support-chat-fcm-notification":
                const supportMessage = job.data
                const fcmTokenForSupport = await findReceiverFCMToken(supportMessage.receiverId)
                if (fcmTokenForSupport) {
                    await sendMobileNotification(fcmTokenForSupport, "Suuport Message", supportMessage.message, { supportMessage: JSON.stringify(supportMessage) })
                }
                break

            default:
                break
        }
    }
    catch (err) {
        console.log("Error executing notification job: ", err)
    }
}, {
    connection: redisConnection,
    concurrency: 10
})


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