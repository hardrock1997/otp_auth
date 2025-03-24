const app = require("./app");

const PORT = process.env.PORT || 2025;

app.listen(PORT, () => {
  console.log("App started...............");
});
