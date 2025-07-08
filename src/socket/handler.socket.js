import { Server } from "socket.io";

import { verifyToken } from "../utils/jwt.js";
import Message from "../database/models/messages.model.js";
import { createOrUpdateConversation } from "../controllers/conversation.controller.js";

const onlineUsers = new Map();

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // or specific origin(s)
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const user = verifyToken(token);
    console.log("token: ", token)
    console.log("user: ", user)
    if (user) {
      socket.user = user;
      return next();
    } else {
      return next(new Error("Un Authorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id;
    onlineUsers.set(userId, socket.id);

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
      const reciverSocketId = onlineUsers.get(to);
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

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
    });
  });
};

export default initSocket;
