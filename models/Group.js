import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
  users: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  groupType: {
    type: String,
    required: [true, "Group type is required"],
    enum: ["private", "public"],
  },
});

const Group = mongoose.model("Group", GroupSchema);
export default Group;
