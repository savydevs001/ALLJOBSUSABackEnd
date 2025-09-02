import Message from "../database/models/messages.model.js";
import mongoose, { mongo } from "mongoose";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import { z } from "zod";

const getMessagesWithProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    const currentUserRole = req.user?.role;
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

    let currentUser;
    switch (currentUserRole) {
      case "employer":
        currentUser = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        currentUser = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        currentUser = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }
    if (!currentUser) {
      return res.status(404).json({ message: "User not found!" });
    }

    const filters = {
      $or: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId },
      ],
    };

    let user = null;
    let userRole = "employer";
    user = await EMPLOYER.findById(withUserId);
    if (!user) {
      user = await FREELANCER.findById(withUserId);
      userRole = "freelancer";
      if (!user) {
        user = await JOBSEEKER.findById(withUserId);
        userRole = "job-seeker";
        if (!user) {
          return res
            .status(400)
            .json({ message: "sender or receiver not found" });
        }
      }
    }

    // const other user blocked this user
    const isBlockedByOther = (user.blocked || []).some(
      (e) => currentUser._id.toString() === e.userId.toString()
    );

    // is confidential only in case of employer and job-seekre
    let confidential = false;
    if (userRole === "employer" && currentUserRole == "job-seeker") {
      confidential = (user.confidentials || []).some(
        (e) => e.userId?.toString() === currentUser._id.toString()
      );
    }

    const receiver = {
      _id: user._id,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
      userRole,
      blocked: isBlockedByOther,
      confidential,
    };

    const isblocked = (currentUser.blocked || []).some(
      (e) => e.userId === withUserId.toString()
    );
    if (isblocked) {
      return res
        .status(200)
        .json({ blocked: true, data: { receiver, messages: [] }, new: false });
    }

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
        blocked: false,
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
      blocked: false,
    });
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid sender or receiver Id" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
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

    const [freelancers, employers, jobseekers] = await Promise.all([
      FREELANCER.find({ _id: { $in: userIds } }).select(
        "fullName profilePictureUrl blocked"
      ),
      EMPLOYER.find({ _id: { $in: userIds } }).select(
        "fullName profilePictureUrl blocked confidentials"
      ),
      JOBSEEKER.find({ _id: { $in: userIds } }).select(
        "fullName profilePictureUrl blocked"
      ),
    ]);

    const userMap = new Map();
    [...freelancers, ...employers, ...jobseekers].forEach((user) => {
      userMap.set(user._id.toString(), {
        _id: user._id,
        fullName: user.fullName,
        profilePictureUrl: user.profilePictureUrl,
        blocked: user.blocked || [],
        confidentials: user.confidentials || [],
      });
    });

    const enrichedConversations = conversations
      .map((msg) => {
        const isSender = msg.senderId.toString() === userId.toString();
        const otherId = isSender
          ? msg.receiverId.toString()
          : msg.senderId.toString();
        const userInfo = userMap.get(otherId) || {
          _id: "",
          fullName: "Unknown",
          profilePictureUrl: null,
          blocked: [],
          confidentials: user.confidentials || [],
        };

        const enriched = {
          message: msg.latestMessage,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          sentAt: msg.sentAt,
          attachments: msg.attachments,
          isConfidential: userInfo.confidentials.some(
            (e) => e.userId.toString() === userId.toString()
          ),
          user: {
            _id: userInfo._id,
            fullName: userInfo.fullName,
            profilePictureUrl: userInfo.profilePictureUrl,
          },
        };

        enriched.unseenCount = msg.unseenCount;

        // current user blocked other user
        const isBlocked = (user.blocked || []).some(
          (e) => e.userId.toString() === userInfo._id.toString()
        );
        enriched.isBlocked = isBlocked;

        // const other user blocked this user
        const isBlockedByOther = (userInfo.blocked || []).some(
          (e) => user._id.toString() === e.userId.toString()
        );
        enriched.isBlockedByOther = isBlockedByOther;

        return enriched;
      })
      .sort((a, b) => {
        if (a.isBlocked === b.isBlocked) return 0;
        return a.isBlocked ? 1 : -1;
      });

    let confidentials = [];
    if (userRole == "employer") {
      confidentials = (user.confidentials || []).map((e) =>
        e.userId.toString()
      );
    }

    return res.json({ chats: enrichedConversations, confidentials });
  } catch (err) {
    console.error("❌ Failed to fetch messages:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getTotalUnseenMessages = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const total = await Message.countDocuments({
      receiverId: userId,
      seen: false,
    });

    return res.status(200).json({ total });
  } catch (err) {
    console.error("❌ Error getting total unseen messages:", err);
    return res
      .status(500)
      .json({ message: "Error getting unseen messages count" });
  }
};

// block a user
const blockConversation = async (req, res) => {
  const { blockUserId } = req.body;
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    if (!mongoose.Types.ObjectId.isValid(blockUserId)) {
      return res.status(400).json({ message: "Inalid block user Id" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Inalid user Id" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const isAlreadyBlocked = (user.blocked || []).some(
      (e) => e.userId === blockUserId
    );
    if (isAlreadyBlocked) {
      return res.status(400).json({ message: "User already blocked" });
    }

    user.blocked = [
      ...(user.blocked || []),
      {
        userId: blockUserId,
        at: new Date(),
      },
    ];
    await user.save();

    return res.status(200).json({ message: "User blocked" });
  } catch (err) {
    console.log("Error blocking a user: " + blockUserId, err);
    return res
      .status(500)
      .json({ message: "Error blocking user: ", err: err.message });
  }
};

// un block a user
const unblockConversation = async (req, res) => {
  const { blockUserId } = req.body;
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    if (!mongoose.Types.ObjectId.isValid(blockUserId)) {
      return res.status(400).json({ message: "Inalid block user Id" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Inalid user Id" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const isAlreadyBlocked = (user.blocked || []).some(
      (e) => e.userId === blockUserId
    );
    if (isAlreadyBlocked) {
      user.blocked = (user.blocked || []).filter(
        (e) => e.userId !== blockUserId
      );
      await user.save();
      return res.status(200).json({ message: "User un-blocked successfully" });
    }

    return res.status(400).json({ message: "User not in blocked list" });
  } catch (err) {
    console.log("Error blocking a user: " + blockUserId, err);
    return res
      .status(500)
      .json({ message: "Error blocking user: ", err: err.message });
  }
};

// get blocked users;
const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Inalid user Id" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const blocked = (user.blocked || []).map((e) => e.userId?.toString());

    return res.status(200).json({ blocked });
  } catch (err) {
    console.log("Error blocking a user: " + blockUserId, err);
    return res
      .status(500)
      .json({ message: "Error blocking user: ", err: err.message });
  }
};

// confidential mode on
const confidentialSchema = z.object({
  confiedntialUserId: z.string(),
});
const confidentialModeOn = async (req, res) => {
  const { confiedntialUserId } = confidentialSchema.parse(req.body);
  try {
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(confiedntialUserId)) {
      return res.status(400).json({ message: "Inalid other user Id" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Inalid user Id" });
    }

    const user = await EMPLOYER.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const isAlreadyconfidential = (user.confidentials || []).some(
      (e) => e.userId?.toString() === confiedntialUserId?.toString()
    );
    if (isAlreadyconfidential) {
      return res
        .status(400)
        .json({ message: "User already in confidential list" });
    }

    user.confidentials = [
      ...(user.confidentials || []),
      {
        userId: confiedntialUserId,
        at: new Date(),
      },
    ];
    await user.save();

    return res.status(200).json({ message: "User added to confidetial list" });
  } catch (err) {
    console.log(
      "Error adding a user to confidential list: " + confiedntialUserId,
      err
    );
    return res.status(500).json({
      message: "Error adding a user to confidential list: ",
      err: err.message,
    });
  }
};

// confidential mode off
const confidentialModeOff = async (req, res) => {
  const { confiedntialUserId } = confidentialSchema.parse(req.body);
  try {
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(confiedntialUserId)) {
      return res.status(400).json({ message: "Inalid other user Id" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Inalid user Id" });
    }

    const user = await EMPLOYER.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const isAlreadyconfidential = (user.confidentials || []).some(
      (e) => e.userId?.toString() === confiedntialUserId?.toString()
    );
    if (isAlreadyconfidential) {
      user.confidentials = (user.confidentials || []).filter(
        (e) => e.userId !== confiedntialUserId
      );
      await user.save();
      return res
        .status(200)
        .json({ message: "User removed from confidential list" });
    }

    return res.status(200).json({ message: "User not in confidetial list" });
  } catch (err) {
    console.log(
      "Error removing a user from confidential list: " + confiedntialUserId,
      err
    );
    return res.status(500).json({
      message: "Error removing a user from  confidential list: ",
      err: err.message,
    });
  }
};

export {
  getMessagesWithProfile,
  getConversations,
  getTotalUnseenMessages,
  blockConversation,
  unblockConversation,
  getBlockedUsers,
  confidentialModeOn,
  confidentialModeOff,
};
