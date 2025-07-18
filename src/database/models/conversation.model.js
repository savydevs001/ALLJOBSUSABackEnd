// models/Conversation.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const conversationSchema = new Schema(
  {
    participants: {
      type: [
        {
          type: Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: {
        validator: function (val) {
          return val.length === 2; // Ensure only 2 participants per conversation
        },
        message: "Conversation must have exactly 2 participants.",
      },
    },

    lastMessage: {
      type: String,
    },

    lastMessageAt: {
      type: Date,
    },

    unreadCount: {
      type: Map, // Maps userId => count of unread messages
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Ensure uniqueness of conversation between two users regardless of order
conversationSchema.index(
  { participants: 1 },
  {
    unique: true,
    partialFilterExpression: { participants: { $size: 2 } },
  }
);

// Pre-save hook to keep participant IDs sorted for consistent uniqueness
conversationSchema.pre("save", function (next) {
  if (Array.isArray(this.participants)) {
    this.participants.sort(); // Sort ObjectIds for consistent ordering
  }
  next();
});

const Conversation = model("Conversation", conversationSchema);
export default Conversation;
