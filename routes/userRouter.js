const express = require("express");

const { register,verifyOtp } = require("../controllers/UserController");

const userRouter = express.Router();

userRouter.route("/register").post(register);
userRouter.route("/otp-verification").post(verifyOtp)

module.exports = userRouter;
