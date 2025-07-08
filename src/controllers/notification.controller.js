// utils/notifyUser.js
import Notification from "../database/models/notifications.model.js";

const NotificationTypes = Object.freeze({
  JOB_APPLICATION_STATUS: "job_application_status",
  OFFER_ACCEPTED: "offer_accepted",
  PAYMENT_UPDATE: "payment_update",
  CHAT_MESSAGE: "chat_message",
  SYSTEM_ANNOUNCEMENT: "system_announcement",
});

const NotificationTypeList = Object.values(NotificationTypes);

const notifyUser = async ({
  userId,
  type,
  message,
  relatedEntityId = null,
}) => {
  try {
    // Validate type against enum
    if (!NotificationTypeList.includes(type)) {
      throw new Error(`Invalid notification type: ${type}`);
    }

    const notification = new Notification({
      userId,
      type,
      message,
      relatedEntityId,
    });

    await notification.save();

    // Optional real-time notification:
    // io.to(userId.toString()).emit("new-notification", notification);
  } catch (error) {
    console.error("❌ Failed to create notification:", error.message);

    if (error.message.startsWith("Invalid notification type")) return;

    // Optional retry logic
    notifyUser({ userId, type, message, relatedEntityId });
  }
};

const getAllNotifications = async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const unreadNotifications = await Notification.find({
    userId,
    read: false,
  })
    .sort({ createdAt: -1 }) // most recent first
    .lean();

  res.status(200).json({
    success: true,
    count: unreadNotifications.length,
    notifications: unreadNotifications,
  });
};

const getNotificationById = async (req, res) => {
  const userId = req.user?._id;
  const notificationId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    userId,
  }).lean();

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.status(200).json({
    success: true,
    notification,
  });
};

export {
  notifyUser,
  NotificationTypes,
  getAllNotifications,
  getNotificationById,
};
