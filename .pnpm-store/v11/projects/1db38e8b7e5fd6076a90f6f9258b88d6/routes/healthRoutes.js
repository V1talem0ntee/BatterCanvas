const express = require("express");
const { checkDatabaseConnection } = require("../db");

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    await checkDatabaseConnection();
    return res.json({ status: "ok", database: "connected" });
  } catch {
    return res.status(503).json({
      status: "ok",
      database: "disconnected",
      message: "Server is running, but PostgreSQL is not connected.",
    });
  }
});

module.exports = router;
