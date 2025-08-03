import { Server } from "socket.io";
import dotenv from "dotenv";

import { verifyToken } from "../utils/jwt.js";
import Message from "../database/models/messages.model.js";
import { createOrUpdateConversation } from "../controllers/conversation.controller.js";
import {
  checkOnlineUser,
  deleteOnlineUser,
  getOnlineUser,
  refreshOnlineUser,
} from "./onlineUsers.js";
import mongoose from "mongoose";
import SupportMessage from "../database/models/support-message.model.js";
import { getSupportAdminId } from "../controllers/support.controller.js";

dotenv.config();

const initSocket = (httpServer) => {
  console.log("✅ Socket Server started");
  const io = new Server(httpServer, {
    cors: {
      origin: [process.env.FRONTEND_URL],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const user = verifyToken(token);
    if (user) {
      socket.user = user;
      return next();
    } else {
      return next(new Error("Un Authorized"));
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
      try {
        if (!to || !content) {
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
        };
        if (fileName && fileUrl) {
          details.attachments = {
            fileName,
            fileUrl,
          };
        }
        const message = new Message(details);
        await message.save();
        const receiver = getOnlineUser(to);
        const sender = getOnlineUser(userId);

        if (sender && sender.socketId) {
          io.to(sender.socketId).emit("message", message);
        }
        if (receiver && receiver.socketId) {
          io.to(receiver.socketId).emit("message", message);
        } else {
          message.seen = false;
          await message.save();
        }
      } catch (err) {
        console.log("Error Sending Message: ", err);
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
          console.log("ok supppport");
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
            message,
            seen: false
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
          await supportMessage.save()

          const sender = getOnlineUser(userId);
          if (sender && sender.socketId) {
            console.log("sent to sender")
            io.to(sender.socketId).emit("support-message", supportMessage);
          }

          let tempReceiverId;
          if (mode === "from_user_to_support") {
            tempReceiverId = await getSupportAdminId();
            tempReceiverId = tempReceiverId.toString()
            console.log("tempReceiverId: ", tempReceiverId)
          } else {
            tempReceiverId = receiverId;
          }
          const receiver = getOnlineUser(tempReceiverId);
          if (receiver && receiver.socketId) {
            io.to(receiver.socketId).emit("support-message", supportMessage);
            console.log("sent to reciver")
          } else {
            // supportMessage.seen = false;
            // await supportMessage.save();
          }
        } catch (err) {
          console.log("Error Sending support message: ", err);
          return;
        }
      }
    );

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

export default initSocket;
