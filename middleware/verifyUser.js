import jwt from "jsonwebtoken";
import Profile from "../models/Profile.js";
import User from "../models/User.js";

const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers["token"];
    const JWT_SECRET = process.env.JWT_SECRET;

    if (
      req.session &&
      req.session.cookie &&
      req.session.cookie.expires < new Date()
    ) {
      // Session expired
      return res.status(401).json({
        logout: true,
        status: false,
        msg: "Session expired Please login again",
      });
    }
    if (!token) {
      return res.status(401).json({
        status: false,
        logout: true,
        msg: "Something went wrong Please login again",
      });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        // Token expired or invalid
        return res.status(401).json({
          logout: true,
          status: false,
          msg: "Token expired or invalid Please login again",
        });
      }

      // Log token data (you can customize this based on your needs)
      // console.log("Token Data:", decoded);

      // Store the token data in request for later use in routes
      req.userData = decoded;

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
      next();
    });
  } catch (err) {
    console.error("Error verifying token or session:", err);
    return res
      .status(401)
      .json({ status: false, msg: "internal server error" });
  }
};
export default verifyUser;
