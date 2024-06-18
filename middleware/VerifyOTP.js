import OTP from "../models/Otp.js";

const verifyOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;
    console.log(req.session.userData);
    console.log(JSON.stringify(req.sessionID));
    const { email } = req.session.userData;
    let otpDB = await OTP.findOne({ email });
    if (!otpDB) {
      req.session.status = false;
      return res.status({
        status: false,
        msg: "Session expired",
      });
    }

    if (parseInt(otp) !== otpDB.Otp) {
      req.session.status = false;
      return res.status(500).json({
        status: false,
        msg: "Invalid OTP or Session expired",
      });
    }

    if (parseInt(otp) === otpDB.Otp && email === otpDB.email) {
      otpDB = await OTP.findByIdAndDelete(otpDB._id);
      otpDB = await OTP.create({
        email,
        Otp: 0,
        isAuthenticated: true,
      });
      //   // OTP is correct, allow user
      req.session.status = true;
      console.log(JSON.stringify(req.sessionID));
      next();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      msg: "Internal Server Error",
      error: error,
      s: req.session,
      sessionId: JSON.stringify(req.sessionID),
    });
  }
};
export default verifyOTP;
