import express from "express";
const router = express.Router();
import Profile from "../models/Profile.js";
import verifyUser from "../middleware/verifyUser.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import { timeAgo } from "./Auth.js";
import Bookmark from "../models/Bookmark.js";
import Notification from "../models/Notification.js";
import { customEvent } from "../Socket/Socket.js";
import { deleteImage, postUpload } from "../storage/storage.js";

router.get("/getPosts", verifyUser, async (req, res) => {
  try {
    const userName = req.query.userName;
    let b = parseInt(req.query.b);
    b = b <= 0 ? 1 : b;

    const profile = await Profile.findOne({ username: userName });
    if (!profile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    const userProfile = await Profile.findOne({ user: req.userData.id });

    if (!userProfile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    const f = userProfile.following.includes(profile._id);
    if (userProfile.username != profile.username) {
      if (profile.accountType === "private" && !f) {
        return res.json({
          status: false,
          msg: "private account",
          accountType: "private",
        });
      }
    }

    const pageSize = 6;
    const skip = (b - 1) * pageSize;

    const postCount = await Post.countDocuments({ profile: profile._id });
    const posts = await Post.find(
      { profile: profile._id },
      { profile: false, user: false, __v: false }
    )
      .skip(skip)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .exec();

    if (posts.length === 0) {
      return res.json({ status: false, msg: "end of Page" });
    }

    const arr = await Promise.all(
      posts.map(async (post) => {
        const comments = await Promise.all(
          post.comment.map(async (id) => {
            const comment = await Comment.findById(id);
            if (!comment) return;

            const commentOwner = await Profile.findById(comment.profile);
            if (!commentOwner) return;

            return {
              comment: comment.comment,
              userName: commentOwner.username,
              profile: commentOwner.photo,
              createdAt: timeAgo(comment.createdAt),
            };
          })
        );

        const bookMark = await Bookmark.findOne({
          profile: userProfile._id,
          post: post._id,
        });

        const obj = {
          caption: post.caption,
          comment: comments.filter(Boolean).reverse(),
          createdAt: timeAgo(post.createdAt),
          _id: post._id,
          image: post.image,
          likes: post.likes.length,
          postLiked: post.likes.includes(userProfile._id),
          postSaved: bookMark ? true : false,
          postOwner: profile.username,
        };

        return obj;
      })
    );

    return res.json({
      status: true,
      msg: "user posts",
      posts: arr.filter(Boolean),
      postCount: postCount,
      userName: profile.username,
      profilePicture: profile.photo,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.post(
  "/addPost",
  verifyUser,
  postUpload.single("image"),
  async (req, res) => {
    try {
      const { caption } = req.body;

      const profile = await Profile.findOne({ user: req.userData.id });
      const post = await Post.create({
        user: profile._id,
        profile: profile._id,
        caption: caption,
        image: req.file.path,
      });

      req.userData = null;
      req.tempPost = null;
      res.json({ status: true, post, msg: "New Post Added" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: false,
        msg: "Internal Server Error",
      });
    }
  }
);

router.post("/like-post", verifyUser, async (req, res) => {
  try {
    const postID = req.headers["postid"];

    const msg = {
      Like: "Liked your post",
      Comment: "Commented on your post",
      Request: "Sent you follow request",
      Follow: "Started following you",
    };

    // Find the user's profile
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

    // Check if the user is following the post's author (if private)
    const reqUserProfile = await Profile.findById(post.profile);
    if (!reqUserProfile) {
      return res.status(404).json({
        status: false,
        msg: "Profile not found",
      });
    }

    if (
      reqUserProfile.accountType === "private" &&
      !profile.following.includes(reqUserProfile.user) &&
      !reqUserProfile._id.toString() === profile._id.toString()
    ) {
      return res.status(400).json({
        status: false,
        msg: "Follow this account to like and add comment on this post",
      });
    }

    // Check if the user has already liked the post
    const liked = post.likes.includes(profile._id);

    // Update post likes based on user's action
    const update = liked
      ? { $pull: { likes: profile._id } } // Unlike post
      : { $push: { likes: profile._id } }; // Like post

    // Update the post
    await Post.findByIdAndUpdate(postID, update);
    if (!liked) {
      let newNotification = await Notification.findOne({
        user: reqUserProfile._id,
        from: profile._id,
        type: "Like",
        post: post._id,
      });
      if (newNotification) {
        await Notification.findByIdAndDelete(newNotification._id);
      }
      newNotification = await Notification.create({
        user: reqUserProfile._id,
        from: profile._id,
        type: "Like",
        post: post._id,
      });
      let obj2 = {
        _id: newNotification._id,
        msg: ` ${msg["Like"]}`,
        userProfile: profile.photo,
        userName: profile.username,
        time: timeAgo(newNotification.createdAt),
        post: post.image,
        type: newNotification.type,
        seen: newNotification.seen,
        btnText: null,
      };

      if (reqUserProfile.username !== profile.username) {
        customEvent("newNotification", {
          obj: obj2,
          to: reqUserProfile.username,
          link: `${process.env.CLIENT_HOST}/profile/${profile.username}`,
        });
      }
    }

    return res.json({
      status: true,
      like: !liked,
      msg: liked ? "Post unLiked" : "Post liked",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});
router.post("/add-comment", verifyUser, async (req, res) => {
  try {
    const postID = req.headers["postid"];
    const comment = req.headers["comment"];

    if (comment.length <= 0) {
      return res.status(400).json({
        status: false,
        msg: "Can not post empty Comment ",
      });
    }

    const msg = {
      Like: "Liked your post",
      Comment: "Commented on your post",
      Request: "Sent you follow request",
      Follow: "Started following you",
    };
    // Find the user's profile
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

    // Check if the user is following the post's author (if private)
    const reqUserProfile = await Profile.findById(post.profile);
    if (!reqUserProfile) {
      return res.status(404).json({
        status: false,
        msg: "Profile not found",
      });
    }

    if (
      reqUserProfile.accountType === "private" &&
      !profile.following.includes(reqUserProfile.user) &&
      !reqUserProfile._id.toString() === profile._id.toString()
    ) {
      return res.status(400).json({
        status: false,
        msg: "Follow this account to like and add comment on this post",
      });
    }

    const newComment = await Comment.create({
      post: post._id,
      comment,
      profile: profile._id,
    });

    post.comment.push(newComment._id);
    await post.save();

    const obj = {
      comment: newComment.comment,
      userName: profile.username,
      profile: profile.photo,
      createdAt: timeAgo(newComment.createdAt),
    };

    const newNotification = await Notification.create({
      user: reqUserProfile._id,
      from: profile._id,
      type: "Comment",
      post: post._id,
    });

    let obj2 = {
      _id: newNotification._id,
      msg: ` ${msg["Comment"]}`,
      userProfile: profile.photo,
      userName: profile.username,
      time: timeAgo(newNotification.createdAt),
      post: post.image,
      type: newNotification.type,
      seen: newNotification.seen,
      btnText: null,
    };

    if (reqUserProfile.username !== profile.username) {
      customEvent("newNotification", {
        obj: obj2,
        to: reqUserProfile.username,
        link: `${process.env.CLIENT_HOST}/profile/${profile.username}`,
      });
    }
    return res.json({
      status: true,
      msg: "Comment Added",
      comment: obj,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.post("/save-post", verifyUser, async (req, res) => {
  try {
    const postID = req.headers["postid"];
    // Find the user's profile
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

    // Check if the user is following the post's author (if private)
    const postOwner = await Profile.findById(post.profile);

    if (!postOwner) {
      return res.status(404).json({
        status: false,
        msg: "Profile not found",
      });
    }

    if (
      postOwner.accountType === "private" &&
      !profile.following.includes(postOwner.user) &&
      !postOwner._id.toString() === profile._id.toString()
    ) {
      return res.status(400).json({
        status: false,
        msg: "Follow this account to like and add comment on this post",
      });
    }

    // Check if the post is already saved by the user
    const bookmark = await Bookmark.findOneAndDelete({
      profile: profile._id,
      post: post._id,
    });

    if (bookmark) {
      return res.json({
        status: true,
        save: false,
        msg: "Post removed",
      });
    }

    // Save the post
    await Bookmark.create({
      profile: profile._id,
      post: post._id,
    });

    return res.json({
      status: true,
      save: true,
      msg: "Post saved",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.get("/get-saved-post", verifyUser, async (req, res) => {
  try {
    let page = parseInt(req.query.b) || 1;
    const pageSize = 6;
    const skip = (page - 1) * pageSize;

    const profile = await Profile.findOne({ user: req.userData.id });
    if (!profile) {
      return res.status(400).json({ status: false, msg: "User not found" });
    }

    const savedPosts = await Bookmark.find({ profile: profile._id })
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .populate({ path: "post", populate: { path: "profile" } })
      .exec();

    const posts = await Promise.all(
      savedPosts.map(async (item) => {
        const post = await Post.findById(item.post);
        if (!post) return;

        const postOwner = await Profile.findById(post.profile);
        if (!postOwner) return;

        if (
          postOwner.accountType === "private" &&
          !profile.following.includes(postOwner.user) &&
          !postOwner._id.toString() === profile._id.toString()
        ) {
          return;
        }

        const comments = await Promise.all(
          post.comment.map(async (id) => {
            const comment = await Comment.findById(id);
            if (!comment) return;

            const commentOwner = await Profile.findById(comment.profile);
            if (!commentOwner) return;

            return {
              comment: comment.comment,
              userName: commentOwner.username,
              profile: commentOwner.photo
                ? `${req.protocol}://${req.get("host")}/${commentOwner.photo}`
                : null,
              createdAt: timeAgo(comment.createdAt),
            };
          })
        );

        return {
          caption: post.caption,
          comment: comments.filter(Boolean).reverse(),
          createdAt: timeAgo(post.createdAt),
          _id: post._id,
          image: post.image,
          likes: post.likes.length,
          postLiked: post.likes.includes(profile._id),
          postSaved: true,
          postOwner: postOwner.username,
        };
      })
    );

    const postCount = await Bookmark.countDocuments({ profile: profile._id });

    if (savedPosts.length === 0) {
      return res.json({ status: false, msg: "End of page" });
    }
    const arr = posts.filter(Boolean);
    return res.json({
      status: true,
      msg: "User saved posts",
      posts: arr,
      postCount,
      userName: profile.username,
      profilePicture: profile.photo,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.delete("/delete-post", verifyUser, async (req, res) => {
  try {
    const postID = req.headers["postid"];

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

    if (!postOwner._id.equals(profile._id)) {
      return res.status(400).json({ status: false, msg: "unauthorized" });
    }

    console.log(post.image);
    const getPublicId = post.image
      ? post.image.split("/").pop().split(".")[0]
      : null;
    if (getPublicId) {
      const result = await deleteImage(`posts/${getPublicId}`);
      console.log(getPublicId);
      if (result.result != "ok") {
        console.log(result);
        return res.status(500).json({
          status: false,
          msg: "Internal Server Error DELETE",
        });
      }
    }

    await Post.findByIdAndDelete(postID);

    await Bookmark.deleteMany({ post: postID });

    return res.json({ status: true, msg: " Post Removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

export default router;
