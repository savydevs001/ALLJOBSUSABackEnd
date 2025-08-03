// models/Message.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Attachment Sub-schema
const attachmentSchema = new Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
  },
  { _id: false }
);

// Message Schema
const supportMessageSchema = new Schema(
  {
    senderId: String,
    receiverId: String,
    ticketId: { type: String, required: true },

    message: { type: String, required: true },

    sentAt: { type: Date, default: Date.now },
    seen: { type: Boolean, default: true },
    attachments: attachmentSchema,
  },
  {
    timestamps: false, // sentAt is already explicitly handled
  }
);

const SupportMessage = model("SupportMessage", supportMessageSchema);
export default SupportMessage;
