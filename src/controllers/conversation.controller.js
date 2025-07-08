import Conversation from "../database/models/conversation.model.js";
import User from "../database/models/users.model.js";
import mongoose from "mongoose";

const conversationBuffer = new Map();
const createOrUpdateConversation = ({ senderId, receiverId, message }) => {
  try {
    const key = [senderId.toString(), receiverId.toString()].sort().join("-");
    const existing = conversationBuffer.get(key);

    conversationBuffer.set(key, {
      participants: key.split("-"),
      lastMessage: message,
      lastMessageAt: new Date(),
      unreadCount: {
        ...(existing?.unreadCount || {}),
        [receiverId]: (existing?.unreadCount?.[receiverId] || 0) + 1,
      },
    });
  } catch (err) {
    console.log("❌ Error while updating conversation memory: ", err);
  }
};

try {
  setInterval(
    async () => {
      if (conversationBuffer.size === 0) return;
      const updates = [...conversationBuffer.entries()];
      conversationBuffer.clear();

      try {
        for (const [key, data] of updates) {
          await Conversation.findOneAndUpdate(
            { participants: data.participants },
            {
              $set: {
                lastMessage: data.lastMessage,
                lastMessageAt: data.lastMessageAt,
              },
              $inc: {
                [`unreadCount.${data.participants[1]}`]: 1, // increment for receiver
              },
              $setOnInsert: {
                participants: data.participants,
              },
            },
            { upsert: true }
          );
        }
      } catch (err) {
        console.log("❌ Error while updating conversation:", err);
      }
    },

    3000
  );
} catch (err) {
  console.log("❌ Error while updating conversations: ", err);
}

const getUnreadConversationsCount = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = String(req.user._id);

    const unreadConversations = await Conversation.find({
      [`unreadCount.${userId}`]: { $gt: 0 },
    }).lean();

    console.log("unreadConversations: ", unreadConversations);
    const totalUnreadMessages = unreadConversations.reduce((acc, convo) => {
      const count = convo.unreadCount?.[userId] || 0;
      return acc + count;
    }, 0);

    return res.status(200).json({
      unreadCount: unreadConversations.length,
      totalUnreadMessages,
    });
  } catch (err) {
    console.error("Error in getUnreadConversationsCount:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getUserConversations = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filters = {
      participants: userId,
    };

    const [total, conversations] = await Promise.all([
      Conversation.countDocuments(filters),
      Conversation.find(filters)
        .sort({ lastMessageAt: -1 }) // most recent first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
    ]);

    // ✅ Extract other user IDs from participants
    const otherUserIds = conversations
      .map((conv) => conv.participants.find((id) => id.toString() !== userId))
      .filter(Boolean); // avoids undefined in 1-participant convs

    const otherUsers = await User.find({ _id: { $in: otherUserIds } })
      .select("profile")
      .lean();

    const userMap = Object.fromEntries(
      otherUsers.map((user) => [user._id.toString(), user])
    );

    // ✅ Attach other user info and unread counts
    const populatedConversations = conversations.map((conversation) => {
      const otherParticipantId = conversation.participants.find(
        (id) => id.toString() !== userId
      );

      return {
        ...conversation,
        otherParticipant: userMap[otherParticipantId?.toString()] || null,
        unreadCount: conversation.unreadCount?.[userId] || 0,
      };
    });

    return res.status(200).json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      results: populatedConversations.length,
      conversations: populatedConversations,
    });
  } catch (error) {
    console.error("❌ Failed to fetch conversations:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const markConversationAsRead = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const conversationId  = req.params.id;

    // Validate conversationId
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }

    const conversation = await Conversation.findOne({ _id: conversationId });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.participants.includes(userId)) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this conversation" });
    }

    // Only update if there are unread messages
    const currentCount = conversation.unreadCount?.get(userId) || 0;
    if (currentCount === 0) {
      return res.status(200).json({ message: "Already marked as read" });
    }

    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    return res.status(200).json({ message: "Conversation marked as read" });
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

export {
  createOrUpdateConversation,
  getUnreadConversationsCount,
  getUserConversations,
  markConversationAsRead
};
