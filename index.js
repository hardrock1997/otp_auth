//GET the environment variables
require("dotenv").config();
//Connect with the database
require("./database/dbConnection");

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const userRouter = require("./routes/userRouter");
const { errorMiddleware } = require("./middleware/error");

const PORT = process.env.PORT || 2025;

const app = express();

//TO avoid cors error while connecting with the frontend
app.use(
  cors({
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "PUT", "POST", "DELETE"],
    credentials: true,
  })
);

// app.use(cookieParser)

app.use(express.json());

app.use(morgan("dev"));

app.use("/api/v1", userRouter);

//middleware to handle error in the entire backend
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log("App started...............");
});
