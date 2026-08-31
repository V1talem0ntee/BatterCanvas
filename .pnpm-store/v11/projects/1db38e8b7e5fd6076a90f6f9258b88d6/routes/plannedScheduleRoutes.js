const express = require("express");
const {
  listPlannedCourses,
  addPlannedCourse,
  movePlannedCourse,
  removePlannedCourse,
} = require("../controllers/plannedSchedule");
const { requireAuth } = require("../middleware/token");

const router = express.Router();

// A planned course is addressed by courseId and semesterId because no class
// section is selected during degree planning.
router.get("/planned-courses", requireAuth, listPlannedCourses);
router.post("/planned-courses", requireAuth, addPlannedCourse);
router.patch(
  "/planned-courses/:courseId/:semesterId",
  requireAuth,
  movePlannedCourse
);
router.delete(
  "/planned-courses/:courseId/:semesterId",
  requireAuth,
  removePlannedCourse
);

// Keep the frontend-facing route name as an alias while both clients use the
// same controller logic and response format.
router.get("/planned-schedule", requireAuth, listPlannedCourses);
router.post("/planned-schedule", requireAuth, addPlannedCourse);
router.patch(
  "/planned-schedule/:courseId/:semesterId",
  requireAuth,
  movePlannedCourse
);
router.delete(
  "/planned-schedule/:courseId/:semesterId",
  requireAuth,
  removePlannedCourse
);

module.exports = router;