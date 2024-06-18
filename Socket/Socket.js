import sendNotification from "../firebase.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Messages.js";
import Profile from "../models/Profile.js";
import jwt from "jsonwebtoken";
import { timeAgo } from "../routes/Auth.js";

var setSocketUser;
const userSocketMap = new Map();
var customEvent;
const JWT_SECRET = process.env.JWT_SECRET;

const socket = (io) => {
  io.on("connection", (socket) => {
    console.log(socket.id);
    socket.emit("socketId", socket.id);

    setSocketUser = (userName) => {
      userSocketMap.set(userName, socket.id);
    };

    customEvent = async (eventName, object) => {
      if (object.to === undefined) {
        throw new Error("user name required");
      }
      if (object.obj === undefined) {
        throw new Error("message required");
      }
      const userSocketId = userSocketMap.get(object.to);
      if (userSocketId) {
        // Emit the event to the userSocketId
        io.to(userSocketId).emit(eventName, object.obj);
      }

      const profile = await Profile.findOne({ username: object.to });
      if (!profile) {
        throw new Error("Profile not found");
      }
      if (profile && profile.firebaseToken) {
        const message = {
          notification: {
            title: "Real Talk",
            body: `${object.obj.userName} ${object.obj.msg}`,
          },
          data: {
            link: object.link,
            icon: object.obj.userProfile,
          },
          token: profile.firebaseToken,
        };

        sendNotification(message);
      }
    };

    // for UserName
    socket.on("checkUserName", async (username, callback) => {
      try {
        const regex = /^[a-zA-Z0-9_.]*$/;

        if (!regex.test(username)) {
          const invalidChars = username
            .split("")
            .filter((char) => !regex.test(char));
          callback({
            available: false,
            message: `${invalidChars} characters are not allowed`,
          });
        }
        const profile = await Profile.findOne({ username });
        if (profile) {
          // Username is not available
          callback({
            available: false,
            message: `Username "${username}" is not available`,
          });
        } else {
          // Username is available
          callback({
            available: true,
            message: `Username "${username}" is  available`,
          });
        }
      } catch (error) {
        console.error(error);
        callback({ available: false, message: "Error checking username" });
      }
    });

    //Search
    socket.on("searchUsers", async (username, callback) => {
      try {
        const regex = new RegExp(`^${username}`);
        const users = await Profile.find({
          username: { $regex: regex },
        }).select({ photo: true, username: true, _id: false });

        for (let user of users) {
          user.photo = user.photo;
        }

        if (users.length > 0) {
          callback({
            users,
            status: true,
          });
        } else {
          callback({
            status: false,
            msg: "User Not Found",
          });
        }
      } catch (error) {
        console.error(error);
        callback({ status: false, message: "Error searching users" });
      }
    });

    socket.on("sendMessage", async (obj, callback) => {
      try {
        if (!obj.token.userToken || !obj.token.chatToken) {
          return callback({ status: false, msg: "token required" });
        }
        if (!obj.msg || obj.msg.length < 1) {
          return callback({ status: false, msg: "message required" });
        }

        const userID = jwt.verify(obj.token.userToken, JWT_SECRET);
        const chatID = jwt.verify(obj.token.chatToken, JWT_SECRET);

        const conversation = await Conversation.findById(chatID.conversationId);

        const userProfileID = userID.id;
        const userProfile = await Profile.find({ user: userProfileID });

        const reqUserId =
          userProfile[0]._id.toString() === conversation.users[0].toString()
            ? conversation.users[1]
            : conversation.users[0];

        const reqUser = await Profile.findById(reqUserId);

        if (!conversation || !userProfile || !reqUser) {
          return callback({
            status: false,
            msg: "Something went wrong please try again after some time",
          });
        }

        const message = await Message.create({
          conversationID: chatID.conversationId,
          sender: userProfile[0]._id,
          to: reqUser._id,
          message: obj.msg,
        });

        let msg = {
          sender: userProfile[0].username,
          to: reqUser.username,
          message: message.message,
          seen: false,
          time: timeAgo(message.createdAt),
        };
        const n = {
          userProfile: userProfile[0].photo,
          msg: "Sent message",
          userName: userProfile[0].username,
          post: null,
        };

        const userSocketId = userSocketMap.get(reqUser.username);
        const obj2 = {
          msg,
          n,
        };
        if (userSocketId) {
          socket.to(userSocketId).emit("newMessage", obj2);
        }
        if (reqUser && reqUser.firebaseToken) {
          const message = {
            notification: {
              title: "Real Talk",
              body: `${userProfile[0].username} ${n.msg}`,
            },
            data: {
              link: `${process.env.CLIENT_HOST}/message/${userProfile[0].username}`,
            },
            token: reqUser.firebaseToken,
          };
          sendNotification(message);
        }

        return callback({ status: true, msg: msg });
      } catch (error) {
        console.log(error);
        return callback({ status: false, msg: "Internal server error" });
      }
    });

    socket.on("customDisconnect", () => {
      userSocketMap.forEach((socketId, name) => {
        if (socketId === socket.id) {
          userSocketMap.delete(name);
        }
      });
      socket.disconnect(true);
      console.log("User custom disconnected");
    });
    socket.on("disconnect", () => {
      // Remove user from userSocketMap upon disconnection
      userSocketMap.forEach((socketId, name) => {
        if (socketId === socket.id) {
          userSocketMap.delete(name);
        }
      });
      console.log("User disconnected");
    });
  });
};

export default socket;
export { setSocketUser, userSocketMap, customEvent };
