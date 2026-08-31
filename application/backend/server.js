require("dotenv").config();

const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const courseRoutes = require("./routes/courseRoutes");
const catalogRoutes = require("./routes/catalogRoutes");
const plannedScheduleRoutes = require("./routes/plannedScheduleRoutes");
const classCartRoutes = require("./routes/classCartRoutes");
const studentPlanningRoutes = require("./routes/studentPlanningRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json());

// Route files define endpoints; controllers contain request/response logic.
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", studentRoutes);
app.use("/api", courseRoutes);
app.use("/api", catalogRoutes);
app.use("/api", plannedScheduleRoutes);
app.use("/api", classCartRoutes);
app.use("/api", studentPlanningRoutes);
app.use("/api", adminRoutes);
app.use("/api", notificationRoutes);

function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log("Server listening on port " + port);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
