import Message from "../database/models/messages.model.js";
import mongoose, { mongo } from "mongoose";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";

const getMessagesWithProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const withUserId = req.params.id;

    if (
      !userId ||
      !withUserId ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(withUserId)
    ) {
      return res.status(400).json({ message: "Invalid sender or receiver Id" });
    }

    const { limit = 50, skip = 0 } = req.query;

    const filters = {
      $or: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId },
      ],
    };

    let user = null;
    user = await EMPLOYER.findById(withUserId);
    if (!user) {
      user = await FREELANCER.findById(withUserId);
      if (!user) {
        return res
          .status(400)
          .json({ message: "sender or receiver not found" });
      }
    }
    const receiver = {
      _id: user._id,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
    };

    const messages = await Message.find(filters)
      .sort({ sentAt: 1 }) // ascending
      .skip(skip)
      .limit(limit)
      .lean();

    if (!messages || messages.length == 0) {
      return res.status(200).json({
        new: true,
        message: "No message exists",
        data: { messages: [], receiver },
      });
    }

    return res.status(200).json({
      data: { receiver, messages },
      new: false,
    });
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

export { getMessagesWithProfile };
