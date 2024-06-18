import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Profile",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Conversation = new mongoose.model("Conversation", conversationSchema);
export default Conversation;
