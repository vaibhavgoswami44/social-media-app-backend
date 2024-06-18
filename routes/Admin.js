import express from "express";
import verifyUser from "../middleware/verifyUser.js";
import Profile from "../models/Profile.js";
import Post from "../models/Post.js";
import { PostReport, UserReport } from "../models/Report.js";
const router = express.Router();

router.post("/report-post", verifyUser, async (req, res) => {
  try {
    const postID = req.headers["postid"];
    const reason = req.headers["reason"];

    const profile = await Profile.findOne({ user: req.userData.id });
    if (!profile) {
      return res.status(404).json({
        status: false,
        msg: "Profile not found",
      });
    }

    // Find the post
    const post = await Post.findById(postID);
    if (!post) {
      return res.status(404).json({
        status: false,
        msg: "Post not found",
      });
    }

    const postOwner = await Profile.findById(post.profile);

    if (!postOwner) {
      return res.status(404).json({
        status: false,
        msg: "user not found",
      });
    }

    if (postOwner._id.equals(profile._id)) {
      return res
        .status(400)
        .json({ status: false, msg: "can not report own post" });
    }

    const report = await PostReport.findOne({
      reportedBy: profile._id,
      user: postOwner._id,
      post: post._id,
    });
    if (report) {
      return res.json({ status: true, msg: "Post Reported" });
    }
    await PostReport.create({
      reportedBy: profile._id,
      user: postOwner._id,
      post: post._id,
      reason: reason,
    });

    return res.json({ status: true, msg: " Post Reported" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});
router.post("/report-user", verifyUser, async (req, res) => {
  try {
    const userName = req.headers["username"];
    const reason = req.headers["reason"];

    const profile = await Profile.findOne({ user: req.userData.id });
    if (!profile) {
      return res.status(404).json({
        status: false,
        msg: "Profile not found",
      });
    }

    const reportedUserProfile = await Profile.findOne({ username: userName });

    if (!reportedUserProfile) {
      return res.status(404).json({
        status: false,
        msg: "user not found",
      });
    }

    if (reportedUserProfile._id.equals(profile._id)) {
      return res
        .status(400)
        .json({ status: false, msg: "can not report self" });
    }

    const report = await PostReport.findOne({
      reportedBy: profile._id,
      reportedUser: reportedUserProfile._id,
      reason: reason,
    });
    if (report) {
      return res.json({ status: true, msg: "User Reported" });
    }

    await UserReport.create({
      reportedBy: profile._id,
      reportedUser: reportedUserProfile._id,
      reason: reason,
    });

    return res.json({ status: true, msg: " User Reported" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

export default router;
