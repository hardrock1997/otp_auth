const { ErrorHandler } = require("../middleware/error");
const catchAsyncError = require("../middleware/catchAsyncError");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

const isAuthenticated = catchAsyncError(async (req, res, next) => {
  //to access the cookies sent from the cient, we use cookies and while setting on the server we use cookie
  const { token } = req.cookies;
  if (!token) {
    return next(new ErrorHandler("User is not authenticated", 400));
  }
  //to know which user is authenticated with its jwt
  //it will have the payload that is set in the jwt in the sign()(here user id)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  req.user = await User.findById(decoded.id);

  next();
});

module.exports = isAuthenticated;
