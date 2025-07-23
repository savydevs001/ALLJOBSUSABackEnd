import Message from "../database/models/messages.model.js";
import mongoose, { mongo } from "mongoose";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";

const getMessagesWithProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    const withUserId = req.params?.id;

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
        user = await JOBSEEKER.findById(withUserId);
        if (!user) {
          return res
            .status(400)
            .json({ message: "sender or receiver not found" });
        }
      }
    }
    const receiver = {
      _id: user._id,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
    };

    const messages = await Message.find(filters)
      .sort({ sentAt: -1 }) // ascending
      .skip(skip)
      .limit(limit)
      .lean();

    if ((!messages || messages.length == 0) && skip == 0) {
      return res.status(200).json({
        new: true,
        message: "No message exists",
        data: { messages: [], receiver },
      });
    }

    await Message.updateMany(
      {
        senderId: withUserId,
        receiverId: userId,
        seen: false,
      },
      {
        $set: { seen: true },
      }
    );

    messages.reverse();

    return res.status(200).json({
      data: { receiver, messages },
      new: false,
    });
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid sender or receiver Id" });
    }

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        $addFields: {
          conversationKey: {
            $cond: [
              { $gt: ["$senderId", "$receiverId"] },
              {
                $concat: [
                  { $toString: "$receiverId" },
                  "_",
                  { $toString: "$senderId" },
                ],
              },
              {
                $concat: [
                  { $toString: "$senderId" },
                  "_",
                  { $toString: "$receiverId" },
                ],
              },
            ],
          },
        },
      },
      { $sort: { sentAt: -1 } },
      {
        $group: {
          _id: "$conversationKey",
          latestMessage: { $first: "$message" },
          senderId: { $first: "$senderId" },
          receiverId: { $first: "$receiverId" },
          sentAt: { $first: "$sentAt" },
          attachments: { $first: "$attachments" },
          allMessages: { $push: "$$ROOT" },
        },
      },
      {
        $addFields: {
          unseenCount: {
            $size: {
              $filter: {
                input: "$allMessages",
                as: "msg",
                cond: {
                  $and: [
                    { $eq: ["$$msg.receiverId", userId] },
                    { $eq: ["$$msg.seen", false] },
                  ],
                },
              },
            },
          },
        },
      },
      { $sort: { sentAt: -1 } },
    ]);

    const userIdsSet = new Set();
    conversations.forEach((e) => {
      const otherId =
        e.senderId.toString() === userId.toString() ? e.receiverId : e.senderId;
      if (otherId) userIdsSet.add(otherId.toString());
    });

    const userIds = Array.from(userIdsSet).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    const [freelancers, employers] = await Promise.all([
      FREELANCER.find({ _id: { $in: userIds } }).select(
        "fullName profilePictureUrl"
      ),
      EMPLOYER.find({ _id: { $in: userIds } }).select(
        "fullName profilePictureUrl"
      ),
    ]);

    const userMap = new Map();
    [...freelancers, ...employers].forEach((user) => {
      userMap.set(user._id.toString(), {
        _id: user._id,
        fullName: user.fullName,
        profilePictureUrl: user.profilePictureUrl,
      });
    });

    const enrichedConversations = conversations.map((msg) => {
      const isSender = msg.senderId.toString() === userId.toString();
      const otherId = isSender
        ? msg.receiverId.toString()
        : msg.senderId.toString();
      const userInfo = userMap.get(otherId) || {
        _id: "",
        fullName: "Unknown",
        profilePictureUrl: null,
      };

      const enriched = {
        message: msg.latestMessage,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        sentAt: msg.sentAt,
        attachments: msg.attachments,
        user: userInfo,
      };

      if (msg.unseenCount > 0) {
        enriched.unseenCount = msg.unseenCount;
      }

      return enriched;
    });

    return res.json({ chats: enrichedConversations });
  } catch (err) {
    console.error("❌ Failed to fetch messages:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    const result = await Message.aggregate([
      {
        $match: {
          receiverId: userId,
          seen: false,
        },
      },
      {
        $addFields: {
          conversationKey: {
            $cond: [
              { $gt: ["$senderId", "$receiverId"] },
              {
                $concat: [
                  { $toString: "$receiverId" },
                  "_",
                  { $toString: "$senderId" },
                ],
              },
              {
                $concat: [
                  { $toString: "$senderId" },
                  "_",
                  { $toString: "$receiverId" },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$conversationKey", // group by unique conversation
        },
      },
      {
        $count: "unreadConversationCount",
      },
    ]);

    const count = result[0]?.unreadConversationCount || 0;

    return res.json({ unreadCount: count });
  } catch (err) {
    console.error("❌ Failed to get unread conversation count:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

export { getMessagesWithProfile, getConversations, getUnreadMessageCount };
