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
    const userId = socket.user._id;
    console.log(`✅ ${userId} connected`);
    refreshOnlineUser(userId, socket.id); // First registration

    socket.on("send-message", async ({ to, content, fileName, fileUrl }) => {
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
      const reciverSocketId = getOnlineUser.get(to);
      if (reciverSocketId) {
        io.to(reciverSocketId).emit("receive-message", message);
      }
      createOrUpdateConversation({
        senderId: userId,
        receiverId: to,
        message: content,
      });
      await message.save();
    });

    socket.on("check-online", (userIds) => {
      let onlineUsers = [];
      if (userIds && userIds.length > 0) {
        onlineUsers = userIds.map((id) => {
          if (checkOnlineUser(id)) {
            return id;
          }
          return;
        });
      }
      socket.emit("verify-online", onlineUsers);
    });

    socket.on("disconnect", () => {
      console.log(`❌ ${userId} dis-connected`);
      deleteOnlineUser(userId);
    });
  });
};

export default initSocket;
