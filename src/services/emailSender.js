import { Queue } from "bullmq";
import IORedis from "ioredis";

// 1. Create a connection to Redis
const redisConnection = new IORedis({
  maxRetriesPerRequest: null, // Important for production
});

// 2. Email Queue
const emailQueue = new Queue("email-queue", { connection: redisConnection });

async function enqueueEmail(to, subject, html) {
  await emailQueue.add("simple-mail", {
    to,
    subject,
    html,
  });
}

export async function sendPolicyUpdatedToMails() {
  await emailQueue.add("send-policy-update", {});
}

export async function sendTermsUpdatedToMails() {
  await emailQueue.add("send-terms-update", {});
}

export default enqueueEmail;
