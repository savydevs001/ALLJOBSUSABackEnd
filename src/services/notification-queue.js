import { Queue } from "bullmq";
import IORedis from "ioredis";

// 1. Create a connection to Redis
const redisConnection = new IORedis({
  maxRetriesPerRequest: null,
});

// 2. Email Queue
const NotificationQueue = new Queue("alljobsusa-notification-queue", { connection: redisConnection });

export async function Send_FCM_Notifcation_OnChat(message) {
    await NotificationQueue.add("chat-fcm-notification", message)
}

export async function Send_FCM_Notifcation_OnSupportChat(message) {
    await NotificationQueue.add("support-chat-fcm-notification", message)
}