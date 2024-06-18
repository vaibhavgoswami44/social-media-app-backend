import mongoose from "mongoose";
import validator from "validator";

const OtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      validate: validator.isEmail,
      unique:true
    },
    Otp: {
      type: Number,
      required: [true, "OTP is required"],
      maxlength: 6,
      minlength: 6,
    },
    isAuthenticated: {
      type: Boolean,
      default: false,
    },
    createdAT: {
      type: Date,
      default: Date.now,
      index: {
        expireAfterSeconds: 300,
      },
    },
    //Deleted After 5 minutes
  },
  { timestamps: true }
);

const OTP = mongoose.model("Otp", OtpSchema);

export default OTP;
