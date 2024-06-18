import mongoose from "mongoose";
import Conversation from "./Conversation.js";

const MessageSchema = new mongoose.Schema({
  conversationID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  message: {
    type: String,
    required: [true, "Message should not be empty"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  seen: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
  ],
});

// Pre-hook to update the conversation's updatedAt timestamp
MessageSchema.pre("save", async function (next) {
  try {
    // Find the conversation and update its updatedAt timestamp
    await Conversation.findByIdAndUpdate(this.conversationID, {
      updatedAt: Date.now(),
    });
    next();
  } catch (error) {
    next(error);
  }
});

const Message = new mongoose.model("Message", MessageSchema);

export default Message;
