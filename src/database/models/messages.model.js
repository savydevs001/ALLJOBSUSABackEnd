// models/Message.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

// Attachment Sub-schema
const attachmentSchema = new Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
  },
  { _id: false }
);

// Message Schema
const messageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },

    message: { type: String, required: true },

    sentAt: { type: Date, default: Date.now },
    attachments: attachmentSchema,
  },
  {
    timestamps: false, // sentAt is already explicitly handled
  }
);

const Message = model("Message", messageSchema);
export default Message;
