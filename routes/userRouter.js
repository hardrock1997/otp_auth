const express = require("express");

const {
  register,
  verifyOtp,
  login,
  logout,
  getUser,
  forgotPassword,
  resetPassword,
} = require("../controllers/UserController");
const isAuthenticated = require("../middleware/auth");

const userRouter = express.Router();

userRouter.route("/register").post(register);
userRouter.route("/otp-verification").post(verifyOtp);
userRouter.route("/login").post(login);
//when firing this, first the isAuthenticated middleware will execute which will make sure that
//logout api is not fired after logging out as well
userRouter.route("/logout").get(isAuthenticated, logout);
userRouter.route("/me").get(isAuthenticated, getUser);
userRouter.route("/password/forgot").post(forgotPassword);
userRouter.route("/password/reset/:token").put(resetPassword);

module.exports = userRouter;
