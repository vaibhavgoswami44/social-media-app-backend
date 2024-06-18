import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
  },
  bio: {
    type: String,
    trim: true,
    default: null,
  },
  accountType: {
    type: String,
    enum: ["public", "private"],
    default: "public",
  },
  website: {
    type: String,
    default: null,
  },
  name: {
    type: String,
    required: [true, "name is required"],
  },
  username: {
    type: String,
    required: [true, "username is required"],
    unique: true,
  },
  lastname: {
    type: String,
    required: [true, "lastname is required"],
  },
  gender: {
    type: String,
    default: null,
  },
  birthday: {
    type: Date,
    default: null,
  },
  photo: {
    type: String,
    default: null,
  },

  requests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
  ],
  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
  ],
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
  ],
  requested: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
  ],
  active: {
    status: {
      type: Boolean,
      default: false,
    },
    socketID: {
      type: String,
      require: true,
    },
  },
  conversations: [
    {
      userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Profile",
        required: true,
      },
      conversationID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
      },
    },
  ],
  firebaseToken: {
    type: String,
    default: null,
  },
});

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
