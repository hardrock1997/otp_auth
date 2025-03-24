// to handle the errors which can come during the async operations in the controller methods
//and if the error arrise then call the Error middleware to handle that
const catchAsyncError = (func) => {
  return (req, res, next) => {
    Promise.resolve(func(req, res, next)).catch(next);
  };
};

module.exports = catchAsyncError;
