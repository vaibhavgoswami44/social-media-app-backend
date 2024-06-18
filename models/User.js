import mongoose from "mongoose";
import validator from "validator";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true,
    required: [true, "Email is required"],
    validate: validator.isEmail,
    unique: [true, "Email already exists"],
  },
  password: {
    type: String,
    minlength: 8,
    required: [true, "Password is required"],
  },

  passwordChangedAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);

export default User;
