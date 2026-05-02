const express = require("express");
const path = require("path");
const { seedDefaultAdmin } = require("./storage");
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");
const classroomRoutes = require("./classroomRoutes");
const quizRoutes = require("./quizRoutes");

const app = express();
const port = process.env.PORT || 3000;
const rootDir = path.join(__dirname, "..");

app.use(express.json());
app.use(express.static(rootDir));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/quiz-results", quizRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

seedDefaultAdmin()
  .then(() => {
    app.listen(port, () => {
      console.log(`Sort Visualizer server running at http://localhost:${port}`);
      console.log("Default admin ready: admin / yen-1019");
    });
  })
  .catch((error) => {
    console.error("Failed to initialize default admin.", error);
    process.exit(1);
  });
