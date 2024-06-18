import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ["Follow", "Like", "Request", "Comment"],
    default: "Like",
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
  },
  seen: {
    type: Boolean,
    default: false,
  },
});

const Notification = mongoose.model("Notification", NotificationSchema);
export default Notification;
