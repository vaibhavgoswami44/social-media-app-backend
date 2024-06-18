import mongoose from "mongoose";

const postReportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
  },
  reason: {
    type: String,
  },
});

const PostReport = new mongoose.model("PostReport", postReportSchema);
const userReportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reason: {
    type: String,
  },
});

const UserReport = new mongoose.model("UserReport", userReportSchema);
export { PostReport, UserReport };
