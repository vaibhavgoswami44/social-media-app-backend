import express from "express";
import { body, validationResult, check } from "express-validator";
import OTP from "../models/Otp.js";
import nodemailer from "nodemailer";
import verifyOTP from "../middleware/VerifyOTP.js";
const router = express.Router();
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import jwt from "jsonwebtoken";
import verifyUser from "../middleware/verifyUser.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import { customEvent, setSocketUser } from "../Socket/Socket.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Messages.js";
import verifyChatToken from "../middleware/VerifyChatToken.js";
import Comment from "../models/Comment.js";
import { deleteImage, profileUpload } from "../storage/storage.js";
const { sign } = jwt;

// check birthday
const isValidDateFormat = (value) => {
  const today = new Date().toISOString().split("T")[0];

  if (value > today) {
    return false;
  }

  // Define your custom date validation logic here
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(value);
};

//convert time into string
const timeAgo = (dateTimeString) => {
  const timestamp = new Date(dateTimeString).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - timestamp) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (let interval in intervals) {
    const count = Math.floor(seconds / intervals[interval]);
    if (count >= 1) {
      return count === 1 ? `1 ${interval} ago` : `${count} ${interval}s ago`;
    }
  }

  return "Just now";
};

router.post(
  "/sign-up",
  [
    body("email", "Invalid Email").isEmail(),
    body("password", "password length must be 8").isLength({ min: 8 }),
    body("firstName", "Invalid first Name").isLength({ min: 3 }),
    body("lastName", "Invalid last Name").isLength({ min: 3 }),
    check("birthDay")
      .custom((value) => {
        if (!Date.parse(value)) {
          return false;
        }
        return isValidDateFormat(value);
      })
      .withMessage(
        "Invalid date. date is greater than today or invalid  date format. Use YYYY-MM-DD."
      ),
    check("userName")
      .custom((value) => {
        const regex = /^[a-zA-Z0-9_.]*$/;

        return regex.test(value);
      })
      .withMessage("Invalid User Name. some character are not allowed"),
  ],
  async (req, res) => {
    try {
      // for validations
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsgs = errors.array().map((error) => error.msg);

        return res.status(400).json({
          status: false,
          msg: errorMsgs,
        });
      }

      //if email already exits
      let user = await User.findOne({ email: req.body.email });
      if (user) {
        return res
          .status(400)
          .json({ status: false, msg: "Email already Exists" });
      }

      //if user name already exits
      let profile = await Profile.findOne({ username: req.body.userName });
      if (profile) {
        return res
          .status(400)
          .json({ status: false, msg: "username already Exists" });
      }

      const email = req.body.email;
      // generate a random 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000);

      // create a Nodemailer transporter object
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL,
          pass: process.env.PASSWORD,
        },
      });

      // configure the email message
      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP is ${otp}.`,
      };

      // send the email
      await transporter.sendMail(mailOptions);

      // store the OTP and user id in the database
      let otpDB = await OTP.findOne({ email });
      if (otpDB) {
        otpDB = await OTP.findByIdAndDelete(otpDB._id);
      }
      otpDB = await OTP.create({
        email,
        Otp: otp,
        isAuthenticated: false,
      });

      console.log(mailOptions);

      req.session.userData = req.body;
      console.log(req.session.userData);

      res.json({
        status: true,
        msg: "OTP has been sent to your email",
        data: req.session.userData,
        sessionId: JSON.stringify(req.sessionID),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: false,
        msg: "Internal Server Error",
        error,
      });
    }
  }
);

//check email already exits

router.post("/check-email", async (req, res) => {
  try {
    //if email already exits
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      return res
        .status(400)
        .json({ status: false, msg: "Email already Exists" });
    }
    return res.status(200).json({ status: true, msg: "Email not Exists" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.post("/register-user", verifyOTP, async (req, res) => {
  try {
    const user = await OTP.findOne({ email: req.session.userData.email });
    if (
      user &&
      req.session.status &&
      user.isAuthenticated &&
      user.email === req.session.userData.email
    ) {
      const { birthDay, lastName, userName, firstName, password, email } =
        req.session.userData;

      let otpDB = await OTP.findOne({ email });
      otpDB = await OTP.findByIdAndDelete(otpDB._id);

      //if email already exits
      let user = await User.findOne({ email });
      if (user) {
        return res
          .status(400)
          .json({ status: false, msg: "Email already Exists" });
      }
      //if user name already exits
      let profile = await Profile.findOne({ username: userName });
      if (profile) {
        return res
          .status(400)
          .json({ status: false, msg: "username already Exists" });
      }

      //Hashing The Password
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      user = await User.create({
        email,
        password: hashPassword,
      });

      profile = await Profile.create({
        user: user._id,
        name: firstName,
        lastname: lastName,
        username: userName,
        birthday: birthDay,
      });

      let jwtSecretKey = process.env.JWT_SECRET;
      let data = {
        id: user._id,
      };

      req.session.userData = null;
      req.session.status = null;

      const token = sign(data, jwtSecretKey, {
        expiresIn: "30d",
      });

      setSocketUser(profile.username);
      res.json({
        status: true,
        token,
        msg: "Signup success full",
        user: {
          name: profile.name,
          userName: profile.username,
          profilePicture: null,
        },
      });
    } else {
      return res.status(400).json({
        status: false,
        msg: "unauthorized",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

//login route

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    //check if email not  exits
    let user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid credentials" });
    }

    //Checking The Password
    const comparePassword = await bcrypt.compare(password, user.password);
    if (!comparePassword) {
      return res.status(400).json({
        status: false,
        msg: "Invalid Credentials ",
      });
    }

    let profile = await Profile.findOne({ user: user._id });

    let jwtSecretKey = process.env.JWT_SECRET;
    let data = {
      id: user._id,
    };

    const token = sign(data, jwtSecretKey, {
      expiresIn: "30d",
    });
    setSocketUser(profile.username);

    res.json({
      status: true,
      token,
      msg: "Welcome Back",
      accountType: profile.accountType,
      user: {
        name: profile.name,
        userName: profile.username,
        passwordChangedDate: timeAgo(user.passwordChangedAt),
        profilePicture: profile.photo,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

//verify logged in user

router.post("/verify-user", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    req.userData = null;
    setSocketUser(profile.username);

    return res.json({
      status: true,
      msg: "Welcome Back",
      accountType: profile.accountType,
      data: {
        name: profile.name,
        userName: profile.username,
        profilePicture: profile.photo,
        passwordChangedDate: timeAgo(user.passwordChangedAt),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

//set firebase token in db
router.put("/setFirebaseToken", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");
    const firebaseToken = req.body.firebaseToken;

    if (!user) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    if (!firebaseToken) {
      return res.status(400).json({
        status: false,
        msg: "firebase token is required",
        logout: true,
      });
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { _id: profile._id },
      {
        $set: {
          firebaseToken: firebaseToken,
        },
      },
      { returnOriginal: false }
    );

    return res.json({
      status: true,
      msg: "Token is Saved to Database",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.get("/getUserProfile/:userName", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    let userProfile = await Profile.findOne({ user: user._id });
    if (!userProfile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ username: req.params.userName });
    if (!profile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    let postCount = await Post.countDocuments({ profile: profile._id });

    let buttonText = "Follow";
    if (userProfile.username !== profile.username) {
      if (profile.followers.includes(userProfile._id)) {
        buttonText = "Unfollow";
      } else if (profile.requests.includes(userProfile._id)) {
        buttonText = "Requested";
      }
    }
    return res.json({
      msg: "user profile details",
      status: true,
      data: {
        buttonText,
        status: true,
        name: profile.name,
        userName: profile.username,
        profilePicture: profile.photo,
        postCount: postCount,
        followingCount: profile.following.length,
        followersCount: profile.followers.length,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

// change account type
router.put("/changeAccountType", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }

    if (profile.accountType === "private") {
      const bulkOps = [];

      bulkOps.push({
        updateOne: {
          filter: { _id: profile._id },
          update: {
            $push: { followers: { $each: profile.requests } },
            $pull: { requests: { $in: profile.requests } },
          },
        },
      });

      // For each request, update the request sender's profile document to remove the request and add profile to following
      profile.requests.forEach((requestId) => {
        bulkOps.push({
          updateOne: {
            filter: { _id: requestId },
            update: {
              $pull: { requested: profile._id },
              $push: { following: profile._id },
            },
          },
        });
      });

      await Profile.bulkWrite(bulkOps);
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { _id: profile._id },
      {
        $set: {
          accountType: profile.accountType === "public" ? "private" : "public",
        },
      },
      { returnOriginal: false }
    );
    return res.json({
      status: true,
      msg: "user profile type changed",
      accountType: updatedProfile.accountType,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

//handle follow unfollow requests routes
router.post("/handleFollowUnfollow", verifyUser, async (req, res) => {
  try {
    const { userName } = req.body;
    const id = req.userData.id;
    const msg = {
      Like: "Liked your post",
      Comment: "Commented on your post",
      Request: "Sent you follow request",
      Follow: "Started following you",
    };

    const [user, profile, reqUser] = await Promise.all([
      User.findById(id).select("-password"),
      Profile.findOne({ user: id }),
      Profile.findOne({ username: userName }),
    ]);

    if (!user || !profile || !reqUser) {
      return res.status(400).json({ status: false, msg: "User not found" });
    }

    if (profile.username === userName) {
      return res.status(400).json({
        logout: true,
        status: false,
        msg: "Something went wrong, please login again",
      });
    }

    const isFollowing = profile.following.includes(reqUser._id);
    if (isFollowing) {
      await Promise.all([
        Profile.findByIdAndUpdate(profile._id, {
          $pull: { following: reqUser._id },
        }),
        Profile.findByIdAndUpdate(reqUser._id, {
          $pull: { followers: profile._id },
        }),
      ]);

      return res.json({
        status: true,
        buttonText: "Follow",
        msg: "Unfollowed",
      });
    } else {
      if (reqUser.accountType === "public") {
        await Promise.all([
          Profile.findByIdAndUpdate(profile._id, {
            $push: { following: reqUser._id },
          }),
          Profile.findByIdAndUpdate(reqUser._id, {
            $push: { followers: profile._id },
          }),
        ]);

        await Notification.findOneAndDelete({
          user: reqUser._id,
          from: profile._id,
          type: "Follow",
        });
        const a = await Notification.create({
          user: reqUser._id,
          from: profile._id,
          type: "Follow",
        });

        const text = profile.following.includes(reqUser._id);

        let obj = {
          _id: a._id,
          msg: ` ${msg[a.type]}`,
          userProfile: "",
          userName: "",
          time: "",
          post: null,
          type: a.type,
          seen: a.seen,
          btnText: text ? "Unfollow" : "Follow",
        };

        obj.userProfile = profile.photo;
        obj.userName = profile.username;
        obj.time = timeAgo(a.createdAt);

        customEvent("newNotification", {
          obj,
          to: userName,
          link: `${process.env.CLIENT_HOST}/profile/${profile.username}`,
        });

        return res.json({
          status: true,
          buttonText: "Unfollow",
          msg: "Following",
        });
      } else {
        const r = profile.requested.includes(reqUser._id);
        if (r) {
          await Promise.all([
            Profile.findByIdAndUpdate(reqUser._id, {
              $pull: { requests: profile._id },
            }),
            Profile.findByIdAndUpdate(profile._id, {
              $pull: { requested: reqUser._id },
            }),
            await Notification.findOneAndDelete({
              user: reqUser._id,
              from: profile._id,
              type: "Request",
            }),
          ]);
          return res.json({
            status: true,
            buttonText: "Follow",
            msg: "Request canceled",
          });
        } else {
          await Promise.all([
            Profile.findByIdAndUpdate(reqUser._id, {
              $push: { requests: profile._id },
            }),
            Profile.findByIdAndUpdate(profile._id, {
              $push: { requested: reqUser._id },
            }),
          ]);
          await Notification.findOneAndDelete({
            user: reqUser._id,
            from: profile._id,
            type: "Request",
          });
          const a = await Notification.create({
            user: reqUser._id,
            from: profile._id,
            type: "Request",
          });

          let obj = {
            _id: a._id,
            msg: ` ${msg[a.type]}`,
            userProfile: "",
            userName: "",
            time: "",
            post: null,
            type: a.type,
            seen: a.seen,
          };

          obj.userProfile = profile.photo;
          obj.userName = profile.username;
          obj.time = timeAgo(a.createdAt);

          customEvent("newNotification", {
            obj,
            to: userName,
            link: `${process.env.CLIENT_HOST}/notifications`,
          });

          return res.json({
            status: true,
            buttonText: "Requested",
            msg: "Request sent",
          });
        }
      }
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: false, msg: "Internal Server Error" });
  }
});

router.get("/notification", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    let b = parseInt(req.query.b);
    b = b <= 0 ? 1 : b;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }
    const msg = {
      Like: "Liked your post",
      Comment: "Commented on your post",
      Request: "Sent you follow request",
      Follow: "Started following you",
    };

    const pageSize = 15;
    const skip = (b - 1) * pageSize;

    const notificationCount = await Notification.countDocuments({
      user: profile._id,
    });
    const notification = await Notification.find({ user: profile._id })
      .skip(skip)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .exec();

    if (notification.length === 0) {
      return res.json({ notificationCount, status: false, msg: "end of Page" });
    }

    let arr = [];

    for (let a of notification) {
      let obj = {
        _id: a._id,
        msg: msg[a.type],
        userProfile: "",
        userName: "",
        time: "",
        post: "",
        type: a.type,
        seen: a.seen,
        btnText: "",
      };
      const userProfile = await Profile.findById(a.from);
      const userPost = await Post.findById(a.post);
      if (!userProfile) {
        continue;
      }
      if (a.type === "Like" || a.type === "Comment") {
        if (!userPost) {
          continue;
        }
      }

      const text = profile.following.includes(a.from);

      obj.userName = userProfile.username;
      obj.userProfile = userProfile.photo;
      obj.post = userPost ? userPost.image : null;
      obj.time = timeAgo(a.createdAt);
      obj.btnText = text ? "Unfollow" : " Follow";

      arr.push(obj);
    }

    return res.json({
      status: true,
      notification: arr,
      notificationCount,
      msg: "user Notification",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.put("/markNotificationSeen", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    await Notification.updateMany(
      { user: profile._id },
      { $set: { seen: true } }
    );

    return res.json({
      status: true,
      msg: "all notification are marked seen",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.put("/logout", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    await Profile.findByIdAndUpdate(profile._id, {
      $set: { firebaseToken: null },
    });

    return res.json({
      status: true,
      msg: "Logout",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.put("/acceptFollowRequest", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const notificationID = req.body.id;
    const notificationType = req.body.type;
    const msg = {
      Like: "Liked your post",
      Comment: "Commented on your post",
      Request: "Sent you follow request",
      Follow: "Started following you",
    };

    if (notificationType != "accept" && notificationType != "decline") {
      return res.status(400).json({
        logout: true,
        status: false,
        msg: "invalid notification type",
      });
    }

    const notification = await Notification.findById(notificationID);
    if (!notification) {
      return res
        .status(400)
        .json({ status: false, msg: "notification not found" });
    }

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    const profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    const from = await Profile.findById(notification.from);
    if (notificationType === "accept") {
      let text = profile.following.includes(notification.from);

      if (!text) {
        await Promise.all([
          Profile.findByIdAndUpdate(profile._id, {
            $push: { followers: notification.from },
          }),
          Profile.findByIdAndUpdate(notification.from, {
            $push: { following: profile._id },
          }),
        ]);

        await Notification.findOneAndDelete({
          user: profile._id,
          from: notification.from,
          type: "Follow",
        });
        var a = await Notification.create({
          user: profile._id,
          from: notification.from,
          type: "Follow",
        });

        let obj = {
          _id: a._id,
          msg: ` ${msg[a.type]}`,
          userProfile: "",
          userName: "",
          time: "",
          post: null,
          type: a.type,
          seen: a.seen,
          btnText: text ? "Unfollow" : "Follow",
        };

        obj.userProfile = from.photo;
        obj.userName = from.username;
        obj.time = timeAgo(a.createdAt);
        customEvent("newNotification", {
          obj,
          to: profile.username,
          link: `${process.env.CLIENT_HOST}/profile/${profile.username}`,
        });

        await Notification.findByIdAndDelete(notificationID);
        await Profile.findByIdAndUpdate(from._id, {
          $pull: { requested: profile._id },
        });
        await Profile.findByIdAndUpdate(profile._id, {
          $pull: { requests: from._id },
        });

        return res.json({
          status: true,
          msg: "follow request accepted",
        });
      } else {
        return res.json({
          status: true,
          msg: "follow request accepted",
        });
      }
    }

    if (notificationType === "decline") {
      await Notification.findByIdAndDelete(notificationID);
      await Profile.updateOne(
        { _id: from._id },
        {
          $pull: { requested: profile._id },
        }
      );

      await Profile.findByIdAndUpdate(profile._id, {
        $pull: { requests: from._id },
      });

      return res.json({
        status: true,
        msg: "follow request declined",
      });
    }
    return res.status(500).json({
      status: false,
      logout: true,
      msg: "Internal Server Error",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.post("/generate-chat-token/:userName", verifyUser, async (req, res) => {
  try {
    const id = req.userData.id;
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    const profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "user not found" });
    }

    const reqUser = await Profile.findOne({ username: req.params.userName });

    if (!reqUser) {
      return res.status(400).json({ status: false, msg: "user not found" });
    }
    if (reqUser.username === profile.username) {
      return res.status(400).json({
        status: false,
        msg: "Sending Messages to self is not available write now",
      });
    }

    let conversationId = 0;

    for (const conversation of profile.conversations) {
      if (conversation.userID.equals(reqUser._id)) {
        conversationId = conversation.conversationID;
        break;
      } else {
        conversationId = false;
      }
    }
    const pageSize = 15;

    const tempID = conversationId;
    var msg = [];
    var messagesCount;

    if (conversationId) {
      messagesCount = await Message.countDocuments({
        conversationID: tempID,
      });

      var messages = await Message.find({
        conversationID: tempID,
      })
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .exec();

      for (let m of messages) {
        let obj = {
          sender: "",
          to: "",
          message: "",
          seen: false,
          time: "",
        };

        const sender = await Profile.findById(m.sender);
        obj.sender = sender.username;

        const to = await Profile.findById(m.to);
        obj.to = to.username;

        obj.message = m.message;
        obj.seen = m.seen.includes(to._id);
        obj.time = timeAgo(m.createdAt);

        msg.push(obj);
      }
    }
    if (!conversationId) {
      conversationId = await Conversation.create({
        users: [{ _id: profile._id }, { _id: reqUser._id }],
      });

      profile.conversations.push({
        userID: reqUser._id,
        conversationID: conversationId._id,
      });

      await profile.save();

      reqUser.conversations.push({
        userID: profile._id,
        conversationID: conversationId._id,
      });

      await reqUser.save();
    }

    let jwtSecretKey = process.env.JWT_SECRET;
    let data = {
      conversationId: conversationId._id,
    };

    const chatToken = sign(data, jwtSecretKey);
    const messageArr = msg.length > 0 ? msg.reverse() : [];
    return res.json({
      status: true,
      msg: "Chat Token",
      chatToken,
      messages: messageArr,
      messagesCount,
      profile: reqUser.photo
        ? `${req.protocol}://${req.get("host")}/${reqUser.photo}`
        : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.get("/getConversations", verifyUser, async (req, res) => {
  try {
    const userId = req.userData.id;
    let page = parseInt(req.query.page) || 1;
    const pageSize = 15; // Number of conversations per page

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "User not found" });
    }

    const profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "Profile not found" });
    }

    const conversationsIds = profile.conversations.map(
      (conversation) => conversation.conversationID
    );
    const conversationsCount = conversationsIds.length;

    const conversations = await Conversation.find({
      _id: { $in: conversationsIds },
    })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const arr = await Promise.all(
      conversations.map(async (conversation) => {
        const reqUser = conversation.users.find(
          (u) => u.toString() !== profile._id.toString()
        );

        const userProfile = await Profile.findById(reqUser);
        if (!userProfile) return null;

        const profileImg = userProfile.photo;

        const lastMessage = await Message.findOne({
          conversationID: conversation._id,
        })
          .select("-conversationId")
          .sort({ createdAt: -1 });

        if (!lastMessage) return null;

        const sender = await Profile.findById(lastMessage.sender);
        const senderUsername = sender ? sender.username : "";

        const to = await Profile.findById(lastMessage.to);
        const toUsername = to ? to.username : "";

        const objMessage = {
          sender: senderUsername,
          to: toUsername,
          message: lastMessage.message,
          time: timeAgo(lastMessage.createdAt),
          seen:
            lastMessage.sender.toString() === profile._id.toString()
              ? true
              : lastMessage.seen.includes(lastMessage.to),
        };

        return {
          profileImg,
          lastMessage: objMessage,
          userName: userProfile.username,
        };
      })
    );

    const filteredArr = arr.filter((item) => item !== null);

    return res.json({
      status: true,
      conversationsList: filteredArr,
      conversationsCount,
      msg: "User conversations list",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.get("/get-chats", verifyUser, verifyChatToken, async (req, res) => {
  try {
    const chatID = req.chatData.conversationId;
    let b = parseInt(req.query.b);
    b = b <= 1 ? 2 : b;
    const pageSize = 15;
    const skip = (b - 1) * pageSize;

    const messagesCount = await Message.countDocuments({
      conversationID: chatID,
    });

    const messages = await Message.find({
      conversationID: chatID,
    })
      .skip(skip)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .exec();

    let msg = [];

    for (let m of messages) {
      let obj = {
        sender: "",
        to: "",
        message: "",
        seen: false,
        time: "",
      };

      const sender = await Profile.findById(m.sender);
      obj.sender = sender.username;

      const to = await Profile.findById(m.to);
      obj.to = to.username;

      obj.message = m.message;
      obj.seen = m.seen.includes(m.to);
      obj.time = timeAgo(m.createdAt);

      msg.push(obj);
    }
    const messageArr = msg.reverse();
    return res.json({
      status: true,
      msg: "Chats",
      messages: messageArr,
      messagesCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});
router.put(
  "/mark-messages-seen",
  verifyUser,
  verifyChatToken,
  async (req, res) => {
    try {
      const chatID = req.chatData.conversationId;
      const userId = req.userData.id;

      const conversation = await Conversation.findById(chatID);

      const message = await Message.find({ conversationID: chatID });

      for (let msg of message) {
        if (!msg.seen.includes(msg.to)) {
          msg.seen.push(msg.to);
          msg.save();
        }
      }

      return res.json({
        status: true,
        msg: "Messages marked seen",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: false,
        msg: "Internal Server Error",
      });
    }
  }
);

router.post("/verify-user-password", verifyUser, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.userData.id;
    //check if email not  exits
    let user = await User.findById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid credentials" });
    }

    //Checking The Password
    const comparePassword = await bcrypt.compare(password, user.password);
    if (!comparePassword) {
      return res.status(400).json({
        status: false,
        msg: "Wrong Password ",
      });
    }

    let otpDB = await OTP.findOne({ email: user.email });
    if (otpDB) {
      otpDB = await OTP.findByIdAndDelete(otpDB._id);
    }
    otpDB = await OTP.create({
      email: user.email,
      Otp: 0,
      isAuthenticated: true,
    });

    res.json({
      status: true,
      msg: "Password Verified",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});
router.post("/update-user-email-password", verifyUser, async (req, res) => {
  try {
    const { email, password } = req.body;

    const userId = req.userData.id;
    //check if email not  exits
    let user = await User.findById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid credentials" });
    }

    let otpDB = await OTP.findOne({ email: user.email });

    if (!otpDB) {
      return res.status(400).json({ status: false, msg: "unauthorized" });
    }
    if (!otpDB.isAuthenticated) {
      return res.status(400).json({ status: false, msg: "unauthorized" });
    }

    if (password) {
      if (password.length < 8) {
        return res.json({
          status: false,
          msg: "password length should be at least 8 character",
        });
      }
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      const updatedUser = await User.findByIdAndUpdate(user._id, {
        password: hashPassword,
        passwordChangedAt: Date.now(),
      });

      if (otpDB) {
        otpDB = await OTP.findByIdAndDelete(otpDB._id);
      }
      return res.json({
        status: true,
        msg: "Password Updated",
        passwordChangedDate: timeAgo(updatedUser.passwordChangedAt),
      });
    }
    if (email) {
      const checkEmail = await User.findOne({ email: email });
      if (checkEmail) {
        return res.json({
          status: false,
          msg: "email already exits",
        });
      }
      const updatedUser = await User.findByIdAndUpdate(user._id, {
        email,
      });

      if (otpDB) {
        otpDB = await OTP.findByIdAndDelete(otpDB._id);
      }
      return res.json({
        status: true,
        msg: "email Updated",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});
router.get("/user-details", verifyUser, async (req, res) => {
  try {
    const userId = req.userData.id;
    //check if email not  exits
    let user = await User.findById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid credentials" });
    }
    const profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "Profile not found" });
    }
    const dateString = profile.birthday;
    const date = new Date(dateString);

    // Extract year, month, and day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    // Form the yyyy-mm-dd format
    const formattedDate = `${year}-${month}-${day}`;

    const obj = {
      photo: profile.photo,
      userName: profile.username,
      name: profile.name,
      webSite: profile.website,
      bio: profile.bio,
      birthday: formattedDate,
      gender: profile.gender,
    };
    res.json({
      status: true,
      msg: "User Personal Details",
      userDetailsTemp: obj,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

router.put(
  "/update-user-details",
  verifyUser,
  profileUpload.single("photo"),
  [
    check("birthday")
      .custom((value) => {
        if (!Date.parse(value)) {
          return false;
        }
        return isValidDateFormat(value);
      })
      .withMessage(
        "Invalid date. date is greater than today or invalid  date format. Use YYYY-MM-DD."
      ),
  ],
  async (req, res) => {
    try {
      const userId = req.userData.id;
      const { webSite, bio, birthday, gender } = req.body;
      // for validations
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsgs = errors.array().map((error) => error.msg);

        return res.status(400).json({
          status: false,
          msg: errorMsgs,
        });
      }

      //check if email not  exits
      let user = await User.findById(userId);
      if (!user) {
        return res
          .status(400)
          .json({ status: false, msg: "Invalid credentials" });
      }
      let profile = await Profile.findOne({ user: user._id });
      if (!profile) {
        return res
          .status(400)
          .json({ logout: true, status: false, msg: "Profile not found" });
      }
      const getPublicId = profile.photo
        ? profile.photo.split("/").pop().split(".")[0]
        : null;
      if (getPublicId) {
        const result = await deleteImage(`profile/${getPublicId}`);
        if (result.result != "ok") {
          return res.status(500).json({
            status: false,
            msg: "Internal Server Error",
          });
        }
      }
      profile = await Profile.findByIdAndUpdate(profile._id, {
        $set: {
          birthday: birthday,
          gender: gender,
          bio: bio,
          website: webSite,
          photo: req.file.path,
        },
      });

      const obj = {
        photo: profile.photo,
        userName: profile.username,
        name: profile.name,
        webSite: profile.website ? profile.website : "",
        bio: profile.bio ? profile.bio : "",
        birthday: profile.birthday ? profile.birthday : "",
        gender: profile.gender ? profile.gender : "",
      };
      res.json({
        status: true,
        msg: "User  Details Updated",
        userDetailsTemp: obj,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: false,
        msg: "Internal Server Error",
      });
    }
  }
);
router.delete("/delete-user", verifyUser, async (req, res) => {
  try {
    const userId = req.userData.id;

    //check if email not  exits
    let user = await User.findById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid credentials" });
    }
    let profile = await Profile.findOne({ user: user._id });
    if (!profile) {
      return res
        .status(400)
        .json({ logout: true, status: false, msg: "Profile not found" });
    }
    let otpDB = await OTP.findOne({ email: user.email });

    if (!otpDB) {
      return res.status(400).json({ status: false, msg: "unauthorized" });
    }
    if (!otpDB.isAuthenticated) {
      return res.status(400).json({ status: false, msg: "unauthorized" });
    }

    const posts = Post.find({ profile: profile._id });

    await Promise.all([
      ...(await posts.map(async (post) => {
        const getPublicId = post.image
          ? post.image.split("/").pop().split(".")[0]
          : null;
        if (getPublicId) {
          const result = await deleteImage(`profile/${getPublicId}`);
          if (result.result != "ok") {
            return res.status(500).json({
              status: false,
              msg: "Internal Server Error",
            });
          }
        }
        await Post.findByIdAndDelete(post._id);
      })),
      ...profile.conversations.map(async (id) => {
        await Message.deleteMany({
          conversationID: id,
        });
        return Conversation.findByIdAndDelete(id);
      }),
      ...profile.following.map(async (id) => {
        return Profile.findByIdAndUpdate(id, {
          $pull: { followers: profile._id },
        });
      }),
      ...profile.requests.map((id) => {
        return Profile.findByIdAndUpdate(id, {
          $pull: { requested: profile._id },
        });
      }),
      ...profile.requested.map((id) => {
        return Profile.findByIdAndUpdate(id, {
          $pull: { requests: profile._id },
        });
      }),
      ...Notification.deleteMany({
        from: profile._id,
      }),
      ...Notification.deleteMany({
        user: profile._id,
      }),
      ...Bookmark.deleteMany({
        profile: profile._id,
      }),
      ...Comment.deleteMany({
        profile: profile._id,
      }),
    ]);
    const getPublicId = profile.photo
      ? profile.photo.split("/").pop().split(".")[0]
      : null;
    if (getPublicId) {
      const result = await deleteImage(`profile/${getPublicId}`);
      if (result.result != "ok") {
        return res.status(500).json({
          status: false,
          msg: "Internal Server Error",
        });
      }
    }
    await Profile.findByIdAndDelete(profile._id);
    await User.findByIdAndDelete(user._id);
    res.json({
      status: true,
      msg: "User  Deleted",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
    });
  }
});

export default router;
export { timeAgo };
