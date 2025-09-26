import admin from "firebase-admin"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const serviceAccount = require("../../firebaseAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function sendMobileNotification(fcmToken, title, body, data = {}) {
  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: data, 
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent  message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}