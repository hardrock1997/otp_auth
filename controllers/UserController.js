const {ErrorHandler} = require("../middleware/error");
const catchAsyncError = require("../middleware/catchAsyncError");
const User = require("../models/UserModel");
const sendEmail = require("../utils/sendMail");
const sendToken = require("../utils/sendToken");

const register = catchAsyncError(async (req, res, next) => {
  try {
    const { name, email, phone, password, verificationMethod } = req.body;
    if (!name || !email || !phone || !password || !verificationMethod) {
      return next(new ErrorHandler("All fields are required", 400));
    }
    function validatePhoneNumber(phone) {
      const phoneRegex = /^\+91[6-9]\d{9}$/;
      return phoneRegex.test(phone);
    }

    if (!validatePhoneNumber(phone)) {
      return next(new ErrorHandler("Invalid phone number", 400));
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
      phone,
      password,
    };
    //create the user entry in the db
    const user = await User.create(userData);

    //generate otp
    const verificationCode = await user.generateVerificationCode();

    user.save();

    //send the otp
    sendVerificationCode(
      verificationCode,
      email,
      res,
      name
    );

    //send back the response
    res.status(200).json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

async function sendVerificationCode(
  verificationCode,
  email,
  res,
  name
) {
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
  const { email, otp, phone } = req.body;

  function validatePhoneNumber(phone) {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }
  if (!validatePhoneNumber(phone)) {
    return next(new ErrorHandler("Invalid phone number", 400));
  }

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
    user.verificationCode = null;
    user.verificationCodeExpire = null;

    //check validateModifiedOnly

    //finally save the user with registeration and otp verification in the db
    await user.save({ validateModifiedOnly: true });

    //generate and send the jwt to the client via cookies
    sendToken(user, 200, "Account verified", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error", 500));
  }
});

module.exports = {
  register,
  verifyOtp,
};
