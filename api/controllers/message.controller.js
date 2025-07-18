import Message from "../database/models/messages.model.js";
import { z } from "zod";
import mongoose from "mongoose";

// ZOD Schema
const editMessageSchema = z.object({
  content: z.string().min(1, "Message text is required"),
});

const getMessages = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const withUserId = req.params.id;

    const page = parseInt(req.query.page) || 1;
    const limit = 100;
    const skip = (page - 1) * limit;

    const filters = {
      $or: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId },
      ],
    };

    const total = await Message.countDocuments(filters);

    const messages = await Message.find(filters)
      .sort({ timestamp: 1 }) // ascending
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      results: messages.length,
      messages,
    });
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

const editMessage = async (req, res) => {
  try {
    const userId = req.user?._id.toString();
    const messageId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    // Validate request body
    const { content } = editMessageSchema.parse(req.body);

    // Fetch message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Authorization: Only sender can edit
    if (message.senderId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this message" });
    }

    // Optional: Check if message is editable (e.g., within 15 minutes)
    const timeLimit = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - message.sentAt > timeLimit) {
      return res
        .status(400)
        .json({ message: "Message can no longer be edited" });
    }

    // Update and save
    message.message = content;
    await message.save();

    return res
      .status(200)
      .json({ message: "Message updated", updatedMessage: message });
  } catch (err) {
    console.error("❌ Failed to edit message:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export { getMessages, editMessage };
