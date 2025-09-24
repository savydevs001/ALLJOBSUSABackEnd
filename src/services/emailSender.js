import { Queue } from "bullmq";
import IORedis from "ioredis";

// 1. Create a connection to Redis
const redisConnection = new IORedis({
  maxRetriesPerRequest: null,
});

// 2. Email Queue
const emailQueue = new Queue("email-queue", { connection: redisConnection });

async function enqueueEmail(to, subject, html) {
  await emailQueue.add("simple-mail", {
    to,
    subject,
    html,
  }, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export async function sendPolicyUpdatedToMails() {
  await emailQueue.add("send-policy-update", {});
}

export async function sendTermsUpdatedToMails() {
  await emailQueue.add("send-terms-update", {});
}

export async function sendRulesUpdatedToMails() {
  await emailQueue.add("send-rules-update", {});
}

export async function sendCookiesUpdatedToMails() {
  await emailQueue.add("send-cookies-update", {});
}

export default enqueueEmail;
