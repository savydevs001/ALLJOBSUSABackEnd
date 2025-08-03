import mongoose from "mongoose";
import SupportMessage from "../database/models/support-message.model.js";
import { v4 as uuidv4 } from "uuid";
import ADMIN from "../database/models/admin.model.js";

let supportId;
const getSupportAdminId = async () => {
  if (!supportId) {
    const admin = await ADMIN.findOne();
    supportId = admin._id;
  }
  return supportId;
};

const getOrCreateSupportTicket = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No or Invalid User" });
    }

    const support = await SupportMessage.findOne({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    if (support && support.ticketId) {
      return res.status(200).json({ ticketId: support.ticketId });
    }

    const newTicket = uuidv4();
    return res.status(200).json({ ticketId: newTicket });
  } catch (err) {
    console.log("❌ Error getting ticket: ", err);
    return res.status(500).json({ message: "Unable to create ticket" });
  }
};

// get support message for current user employer, job-seeker or freelancer
const getSupportMessagesByTicket = async (req, res) => {
  const ticketId = req.params.ticketid;
  const role = req.user?.role;

  if (!ticketId) {
    return res.status(401).json({ message: "Invalid request" });
  }
  if (!ticketId) {
    return res.status(400).json({ message: "Invalid ticket Id" });
  }

  const limit = parseInt(req.query.limit) || 10;
  const skip = parseInt(req.query.skip) || 0;

  try {
    const messages = await SupportMessage.find({
      ticketId: ticketId,
    })
      .sort({ sentAt: -1 }) // newest first
      .skip(skip)
      .limit(limit)
      .lean();

    if (role == "admin") {
      await SupportMessage.updateMany(
        { ticketId: ticketId, seen: false },
        { seen: true }
      );
    }

    messages.reverse();

    res.json({
      chats: messages,
      limit,
      skip,
    });
  } catch (err) {
    console.error("Error fetching ticket messages:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

const getAllSupportThreads = async (req, res) => {
  try {
    const threads = await SupportMessage.aggregate([
      // Sort to get the latest message per ticket
      { $sort: { sentAt: -1 } },

      // Group messages by ticketId
      {
        $group: {
          _id: "$ticketId",
          lastMessage: { $first: "$message" },
          lastTimestamp: { $first: "$sentAt" },
          senderId: { $first: "$senderId" },
          receiverId: { $first: "$receiverId" }, // ✅ Retain receiverId
        },
      },

      // Determine which user ID to resolve (whichever is NOT admin)
      {
        $addFields: {
          resolvedUserId: {
            $cond: {
              if: { $ifNull: ["$senderId", false] },
              then: "$senderId",
              else: "$receiverId",
            },
          },
        },
      },

      // Safely convert resolvedUserId to ObjectId
      {
        $addFields: {
          senderObjectId: {
            $convert: {
              input: "$resolvedUserId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },

      // Count unseen messages for each ticketId
      {
        $lookup: {
          from: "supportmessages",
          let: { ticketId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ticketId", "$$ticketId"] },
                    { $eq: ["$seen", false] },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          as: "unseenMessages",
        },
      },

      // Flatten unseen count
      {
        $addFields: {
          unseenCount: {
            $cond: [
              { $gt: [{ $size: "$unseenMessages" }, 0] },
              { $arrayElemAt: ["$unseenMessages.count", 0] },
              0,
            ],
          },
        },
      },

      // Lookups for sender's full info from different collections
      {
        $lookup: {
          from: "employers",
          localField: "senderObjectId",
          foreignField: "_id",
          as: "senderEmployer",
        },
      },
      {
        $lookup: {
          from: "freelancers",
          localField: "senderObjectId",
          foreignField: "_id",
          as: "senderFreelancer",
        },
      },
      {
        $lookup: {
          from: "jobseekers",
          localField: "senderObjectId",
          foreignField: "_id",
          as: "senderJobSeeker",
        },
      },

      // Combine sender info and role
      {
        $addFields: {
          sender: {
            $cond: {
              if: { $gt: [{ $size: "$senderEmployer" }, 0] },
              then: {
                role: "employer",
                _id: { $arrayElemAt: ["$senderEmployer._id", 0] },
                fullName: { $arrayElemAt: ["$senderEmployer.fullName", 0] },
                profilePictureUrl: {
                  $arrayElemAt: ["$senderEmployer.profilePictureUrl", 0],
                },
              },
              else: {
                $cond: {
                  if: { $gt: [{ $size: "$senderFreelancer" }, 0] },
                  then: {
                    role: "freelancer",
                    _id: { $arrayElemAt: ["$senderFreelancer._id", 0] },
                    fullName: {
                      $arrayElemAt: ["$senderFreelancer.fullName", 0],
                    },
                    profilePictureUrl: {
                      $arrayElemAt: ["$senderFreelancer.profilePictureUrl", 0],
                    },
                  },
                  else: {
                    role: "job-seeker",
                    _id: { $arrayElemAt: ["$senderJobSeeker._id", 0] },
                    fullName: {
                      $arrayElemAt: ["$senderJobSeeker.fullName", 0],
                    },
                    profilePictureUrl: {
                      $arrayElemAt: ["$senderJobSeeker.profilePictureUrl", 0],
                    },
                  },
                },
              },
            },
          },
        },
      },

      // Final output cleanup
      {
        $project: {
          ticketId: "$_id",
          lastMessage: 1,
          lastTimestamp: 1,
          unseenCount: 1,
          sender: 1,
          _id: 0,
        },
      },

      // Sort threads by latest message time
      { $sort: { lastTimestamp: -1 } },
    ]);

    res.json(threads);
  } catch (err) {
    console.error("Error fetching support threads:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


export {
  getOrCreateSupportTicket,
  getSupportAdminId,
  getSupportMessagesByTicket,
  getAllSupportThreads,
};
