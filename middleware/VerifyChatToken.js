import jwt from "jsonwebtoken";

const verifyChatToken = async (req, res, next) => {
  try {
    const token = req.headers["chattoken"];
    const JWT_SECRET = process.env.JWT_SECRET;

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
      req.chatData = decoded;

      next();
    });
  } catch (err) {
    console.error("Error verifying token or session:", err);
    return res
      .status(401)
      .json({ status: false, msg: "internal server error" });
  }
};
export default verifyChatToken;
