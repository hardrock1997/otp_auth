const { ErrorHandler } = require("../middleware/error");
const catchAsyncError = require("../middleware/catchAsyncError");
const User = require("../models/UserModel");
const sendEmail = require("../utils/sendMail");
const sendToken = require("../utils/sendToken");
const crypto = require("crypto");

const register = catchAsyncError(async (req, res, next) => {
  try {
    const { name, email, password, verificationMethod } = req.body;
    if (!name || !email || !password || !verificationMethod) {
      return next(new ErrorHandler("All fields are required", 400));
    }

    //if user has already registered
    const existingUser = await User.findOne({
      $or: [
        {
          email,
          accountVerified: true,
        },
      ],
    });
    //then no need to register
    if (existingUser) {
      return next(
        new ErrorHandler("Phone or email is already registered", 400)
      );
    }

    const registrationAttemptsByUser = await User.find({
      $or: [
        {
          email,
          accountVerified: false,
        },
      ],
    });
    //if the user has tried to register earlier and have reached the limit
    //then return
    if (registrationAttemptsByUser.length > 3) {
      return next(
        new ErrorHandler(
          "You exceeded the maximum number of attempts (3). Please try after an hour "
        ),
        400
      );
    }

    const userData = {
      name,
      email,
      password,
    };
    //create the user entry in the db
    const user = await User.create(userData);

    //generate otp
    const verificationCode = await user.generateVerificationCode();

    user.save();

    //send the otp
    sendVerificationCode(verificationCode, email, res, name);

    //send back the response
    res.status(200).json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

async function sendVerificationCode(verificationCode, email, res, name) {
  try {
    const message = generateEmailTemplate(verificationCode);
    sendEmail({ email, subject: "Your Verification Code", message });
    res.status(200).json({
      success: true,
      message: `Verification email successfully sent to ${name}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Verification code failed to send.",
    });
  }
}

function generateEmailTemplate(verificationCode) {
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <h2 style="color: #4CAF50; text-align: center;">Verification Code</h2>
        <p style="font-size: 16px; color: #333;">Dear User,</p>
        <p style="font-size: 16px; color: #333;">Your verification code is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #4CAF50; padding: 10px 20px; border: 1px solid #4CAF50; border-radius: 5px; background-color: #e8f5e9;">
            ${verificationCode}
          </span>
        </div>
        <p style="font-size: 16px; color: #333;">Please use this code to verify your email address. The code will expire in 10 minutes.</p>
        <p style="font-size: 16px; color: #333;">If you did not request this, please ignore this email.</p>
        <footer style="margin-top: 20px; text-align: center; font-size: 14px; color: #999;">
          <p>Thank you,<br>Your Company Team</p>
          <p style="font-size: 12px; color: #aaa;">This is an automated message. Please do not reply to this email.</p>
        </footer>
      </div>
    `;
}

const verifyOtp = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  try {
    // sorting in descending order to get the latest user entry
    const userAllEnteries = await User.find({
      $or: [
        {
          email,
          accountVerified: false,
        },
      ],
    }).sort({ createdAt: -1 });

    //if the user has not registered and trying to verify the otp
    if (!userAllEnteries) {
      return next(new ErrorHandler("User not found", 404));
    }

    let user;

    //if user has tried registering multiple times
    if (userAllEnteries.length > 1) {
      //keep the latest one
      user = userAllEnteries[0];
      //delete the others
      await User.deleteMany({
        _id: { $ne: user._id },
        $or: [
          {
            email,
            accountVerified: false,
          },
        ],
      });
    }
    //if user has registered only once
    else {
      user = userAllEnteries[0];
    }

    //otp entered does not match with the otp entered
    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Invalid OTP", 400));
    }

    const currentTime = Date.now();
    const verificationCodeExpire = new Date(
      user.verificationCodeExpire
    ).getTime();
    //if the otp send by the client has expired
    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP expired", 400));
    }

    user.accountVerified = true;
    // user.verificationCode = null;
    user.verificationCode = undefined;
    // user.verificationCodeExpire = null;
    user.verificationCodeExpire = undefined;

    //check validateModifiedOnly

    //finally save the user with registeration and otp verification in the db
    await user.save({ validateModifiedOnly: true });

    //generate and send the jwt to the client via cookies
    sendToken(user, 200, "Account verified", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error", 500));
  }
});

const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Email and password are required"), 400);
  }

  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );

  if (!user) {
    return next(new ErrorHandler("Invalid email or password"), 400);
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password"), 400);
  }

  //generate a new jwt and send it to the client
  sendToken(user, 200, "User logged in successfully ", res);
});

const logout = catchAsyncError(async (req, res, next) => {
  //send the response with an empty cookie, removing the jwt token
  res
    .status(200)
    .cookie("token", null, { expires: new Date(Date.now()), httpOnly: true })
    .json({
      success: true,
      message: "logged out successfully",
    });
});

const getUser = catchAsyncError(async (req, res, next) => {
  //this is the user which is logged in, in auth middleware we set it
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

const forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validteBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/${resetToken}`;
  const message = `Your Reset Password Token is:- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then please ignore it.`;

  try {
    sendEmail({
      email: user.email,
      subject: "MERN AUTHENTICATION APP RESET PASSWORD",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ErrorHandler(
        error.message ? error.message : "Cannot send reset password token.",
        500
      )
    );
  }
});

const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  //getting the user who has the same reset password token who has clicked on the password reset url
  //and also his/her user,s reset password token is still valid
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ErrorHandler(
        "Reset password token is invalid or has been expired.",
        400
      )
    );
  }

  //when entering new passwords 2 times on password and confirmPassword inputs
  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password & confirm password do not match.", 400)
    );
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  //sending new jwt after password resetting as well
  sendToken(user, 200, "Reset Password Successfully.", res);
});

module.exports = {
  register,
  verifyOtp,
  login,
  logout,
  getUser,
  forgotPassword,
  resetPassword,
};
