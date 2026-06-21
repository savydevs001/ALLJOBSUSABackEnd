import admin from "firebase-admin"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
let isFirebaseInitialized = false;

try {
  const serviceAccount = require("../../firebaseAccountKey.json");
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    console.log("✓ Firebase initialized successfully");
  }
} catch (error) {
  console.error("✗ Error initializing Firebase:", error.message);
  isFirebaseInitialized = false;
}

export async function sendMobileNotification(fcmToken, title, body, data = {}) {
  if (!isFirebaseInitialized) {
    console.warn("⚠ Firebase is not initialized. Cannot send notification.");
    return;
  }

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
    console.log("✓ Successfully sent message:", response);
  } catch (error) {
    console.error("✗ Error sending message:", error);
  }
}