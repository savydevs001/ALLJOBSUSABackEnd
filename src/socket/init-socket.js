import { Server } from "socket.io";
import dotenv from "dotenv";

import { verifyToken } from "../utils/jwt.js";
import Message from "../database/models/messages.model.js";
import {
  checkOnlineUser,
  deleteOnlineUser,
  getOnlineUser,
  refreshOnlineUser,
} from "./onlineUsers.js";
import mongoose from "mongoose";
import SupportMessage from "../database/models/support-message.model.js";
import {
  getSupportAdminId,
  getSupportIds,
} from "../controllers/support.controller.js";

dotenv.config();

let io;

const initSocket = (httpServer) => {
  console.log("✅ Socket Server started");
  io = new Server(httpServer, {
    cors: {
      origin: [process.env.FRONTEND_URL],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Unauthorized: No token provided"));
    }
    const user = verifyToken(token);
    if (user) {
      socket.user = user;
      return next();
    } else {
      return next(new Error("Un Authorized, Invalid Token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?._id;
    const role =
      socket.user?.role == "employer"
        ? "employer"
        : socket.user?.role == "freelancer"
        ? "freelancer"
        : socket.user?.role == "job-seeker"
        ? "job-seeker"
        : socket.user?.role == "admin"
        ? "admin"
        : socket?.user.role == "manager"
        ? "manager"
        : "";

    if (
      !role ||
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      role == ""
    ) {
      return;
    }

    refreshOnlineUser(userId, socket.id); // First registration
    console.log(`✅ ${userId} connected`);

    socket.broadcast.emit("user-online", { userId });

    socket.on("message", async ({ to, content, fileName, fileUrl }) => {
      await handleMessage({ to, content, fileName, fileUrl, userId: userId });
    });

    socket.on("message-seen", async ({ messageId }) => {
      try {
        console.log("messageId: ", messageId);
        await Message.updateOne({ _id: messageId }, { seen: true });
      } catch (err) {
        console.log("Error updating message to seen");
      }
    });

    socket.on(
      "support-message",
      async ({
        ticketId,
        message,
        fileName,
        fileUrl,
        receiverId,
        mode = "from_user_to_support",
      }) => {
        /***
         * 2 Modes
         *  mode = "from_user_to_support"
         * mode = "from_support_to_user"
         */
        try {
          if (mode === "from_user_to_support") {
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
              console.log("Invalid userId");
              return;
            }
          }

          if (!ticketId) {
            console.log("Invalid Ticket Id");
            return;
          }

          const details = {
            ticketId: ticketId,
            message: message,
            seen: mode == false ,
          };
          if (fileName && fileUrl) {
            details.attachments = {
              fileName,
              fileUrl,
            };
          }

          if (mode === "from_user_to_support") {
            details.senderId = userId;
          } else if (mode === "from_support_to_user") {
            details.receiverId = receiverId;
          } else {
            console.log("❌ Invlaid mode for support chat");
            return;
          }

          const supportMessage = new SupportMessage(details);
          await supportMessage.save();

          const sender = getOnlineUser(userId);
          if (sender && sender.socketId) {
            io.to(sender.socketId).emit("support-message", supportMessage);
          }

          let tempReceiverIds;
          if (mode === "from_user_to_support") {
            tempReceiverIds = await getSupportIds();
          } else {
            tempReceiverIds = [receiverId];
          }

          const receivers = tempReceiverIds.map((e) => getOnlineUser(e));
          if (receivers.length > 0) {
            for (const rec of receivers) {
              if (rec && rec.socketId) {
                io.to(rec.socketId).emit("support-message", supportMessage);
              }
            }
          }
        } catch (err) {
          console.log("Error Sending support message: ", err);
          return;
        }
      }
    );

    socket.on("support-message-seen", async ({ messageId }) => {
      try {
        console.log("ok: ",messageId)
        await SupportMessage.updateOne({ _id: messageId }, { seen: true });
      } catch (err) {
        console.log("Error updating support message to seen");
      }
    });

    socket.on("online", (userIds) => {
      let onlineUsers = [];
      if (userIds && userIds.length > 0) {
        onlineUsers = userIds.filter((id) => checkOnlineUser(id));
      }
      // console.log("online: ", onlineUsers)
      socket.emit("online", onlineUsers);
    });

    socket.on("single-online", ({ userId }) => {
      const online = checkOnlineUser(userId);
      console.log("single-online: " + userId + " " + online);
      socket.emit("single-online", { online });
    });

    socket.on("disconnect", () => {
      console.log(`❌ ${userId} dis-connected`);
      deleteOnlineUser(userId);
      socket.broadcast.emit("user-offline", { userId });
    });
  });
};

const handleMessage = async ({
  to,
  content,
  fileName,
  fileUrl,
  offerId,
  userId,
}) => {
  try {
    if (!to || (!content && !fileUrl && !fileName)) {
      return;
    }
    if (
      mongoose.Types.ObjectId.isValid(to) === false ||
      mongoose.Types.ObjectId.isValid(userId) === false
    ) {
      console.log("Invalid userId or to");
      return;
    }

    if (userId == to) {
      console.log("Sender or Receiver could not be same");
      return;
    }

    const details = {
      senderId: userId,
      message: content,
      receiverId: to,
      seen: false,
    };
    if (fileName && fileUrl) {
      details.attachments = {
        fileName,
        fileUrl,
      };
    }
    if (offerId && mongoose.Types.ObjectId.isValid(offerId)) {
      details.offerId = offerId;
    }
    // console.log("detais: ", details);
    const message = new Message(details);
    await message.save();

    const sender = getOnlineUser(userId);
    if (sender && sender.socketId) {
      io.to(sender.socketId).emit("message", message);
    }
    const receiver = getOnlineUser(to);
    if (receiver && receiver.socketId) {
      io.to(receiver.socketId).emit("message", message);
    }
  } catch (err) {
    console.log("Error Sending Message: ", err);
  }
};

const sendOfferCreationMessage = async ({ to, message, offerId, from }) => {
  try {
    await handleMessage({
      to: to,
      content: message,
      offerId: offerId,
      userId: from,
    });
  } catch (err) {
    console.log("Error sending message after offer creation");
  }
};

const sendNewNotification = (to, notificationId) => {
  const receiver = getOnlineUser(to);
  if (receiver && receiver.socketId) {
    io.to(receiver.socketId).emit("new-notification", { id: notificationId });
  }
};

export { sendOfferCreationMessage, sendNewNotification };

export default initSocket;
