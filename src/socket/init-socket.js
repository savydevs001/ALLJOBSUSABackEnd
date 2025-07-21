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
        : socket.user?.role == "freelancer" || socket.user?.role == "job-seeker"
        ? "freelancer"
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

    socket.broadcast.emit("user-online", {userId});

    socket.on("message", async ({ to, content, fileName, fileUrl }) => {
      if (!to || !content) {
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
      }
      else{
        message.seen = false;
        await message.save()
      }
    });

    socket.on("online", (userIds) => {
      let onlineUsers = [];
      if (userIds && userIds.length > 0) {
        onlineUsers = userIds.filter((id) => checkOnlineUser(id));
      }
      socket.emit("online", onlineUsers);
    });

    socket.on("single-online", ({userId})=> {
      const online = checkOnlineUser(userId)
      console.log("single-online: " + userId + " " + online)
      socket.emit("single-online", {online})
    })

    socket.on("disconnect", () => {
      console.log(`❌ ${userId} dis-connected`);
      deleteOnlineUser(userId);
      socket.broadcast.emit("user-offline", {userId});
    });
  });
};

export default initSocket;
