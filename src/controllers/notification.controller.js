import mongoose from "mongoose";
import Notification from "../database/models/notifications.model.js";
import { sendNewNotification } from "../socket/init-socket.js";

const notifyUser = async (
  { userId, title, message, from },
  mongooseSession = null
) => {
  try {
    const notification = new Notification({
      userId: userId.toString(),
      title,
      message,
      from,
    });

    if (mongooseSession) {
      await notification.save({ session: mongooseSession });
    } else {
      await notification.save();
    }

    sendNewNotification(userId.toString(), notification._id.toString());
  } catch (error) {
    console.error("❌ Failed to create notification:", error.message);
  }
};

const getAllNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { limit = 10, skip = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [unreadNotifications, total] = await Promise.all([
      Notification.find({
        userId,
      })
        .sort({ createdAt: -1 }) // most recent first
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({
        userId,
      }),
    ]);

    const trnsformed = unreadNotifications.map((e) => ({
      _id: e._id,
      title: e.title,
      message: e.message,
      createdAt: e.createdAt,
      read: e.read,
    }));

    res.status(200).json({
      total,
      notifications: trnsformed,
    });
  } catch (err) {
    console.log("❌ Error getting notifications: ", err);
    return res
      .status(500)
      .json({ message: "Error getting notifications", err });
  }
};

const getNotificationById = async (req, res) => {
  try {
    const userId = req.user?._id;
    const notificationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (!notification.read == true) {
      notification.read = true;
      await notification.save();
    }

    const transformed = {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      read: notification.read,
    };

    res.status(200).json({
      notification: transformed,
    });
  } catch (err) {
    console.log("❌ Error getting notification: ", err);
    return res.status(500).json({ message: "Error getting notification", err });
  }
};

const getNotificationCountById = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const notifications = await Notification.countDocuments({
      userId,
      read: false,
    });

    res.status(200).json({
      total: notifications,
    });
  } catch (err) {
    console.log("❌ Error getting unread notification count: ", err);
    return res
      .status(500)
      .json({ message: "Error getting unread notification count", err });
  }
};

export {
  notifyUser,
  getAllNotifications,
  getNotificationById,
  getNotificationCountById,
};
