const express = require("express");
const {
  listNotifications,
  dismissNotification,
  dismissAllNotifications,
  syncNotifications,
} = require("../controllers/notifications");
const { requireAuth } = require("../middleware/token");

const router = express.Router();

router.get("/notifications", requireAuth, listNotifications);
router.post("/notifications/sync", requireAuth, syncNotifications);
router.delete("/notifications", requireAuth, dismissAllNotifications);
router.delete(
  "/notifications/:notificationId",
  requireAuth,
  dismissNotification
);

module.exports = router;
