import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  userName: {
    type: String,
    required: true,
    unique: true,
  },
  photo: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
});

const admin = new mongoose.model("Admin", adminSchema);
export default admin;
