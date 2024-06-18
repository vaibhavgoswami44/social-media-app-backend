import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Your Collection",
    },
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  },
  { timestamps: true }
);

const Bookmark = new mongoose.model("Bookmark", bookmarkSchema);
export default Bookmark;
