const mongoose = require("mongoose");
const dbURL =
  "mongodb+srv://<username>:<password>@cluster0.5leqd.mongodb.net/<dbName>?retryWrites=true&w=majority&appName=Cluster0";

let newDbURL = dbURL.replace("<password>", process.env.DB_PASSWORD);
newDbURL = newDbURL.replace("<username>", process.env.DB_USERNAME);
newDbURL = newDbURL.replace("<dbName>", process.env.DB_NAME);

mongoose
  .connect(newDbURL)
  .then(() => {
    console.log("CONNECTED TO DB------------------");
  })
  .catch((err) => console.log("-----------DB CONNECTION ERROR-----", err));
