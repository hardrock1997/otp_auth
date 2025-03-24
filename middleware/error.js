const {
  SERVER_ERROR_MESSAGE,
  JSON_WEB_TOKEN_INVALID_MESSAGE,
  JSON_WEB_TOKEN_EXPIRED_MESSAGE,
} = require("../utils/constants");

class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

//this is the main function that is invoked by the controller methods > catchAsyncError, catch
//err is the object of ErrorHandler class
const errorMiddleware = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || SERVER_ERROR_MESSAGE;

  if (err.name === "CastError") {
    const message = `Invalid ${err.path}`;
    err = new ErrorHandler(message, 400);
  }
  if (err.name === "JsonWebTokenError") {
    const message = JSON_WEB_TOKEN_INVALID_MESSAGE;
    err = new ErrorHandler(message, 400);
  }
  if (err.name === "TokenExpireError") {
    const message = JSON_WEB_TOKEN_EXPIRED_MESSAGE;
    err = new ErrorHandler(message, 400);
  }
  if (err.code === 11000) {
    const message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
    err = new ErrorHandler(message, 400);
  }

  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

module.exports = { ErrorHandler, errorMiddleware };
