const express = require("express");
const { getCalendar } = require("../controllers/calendar");
const { getDegreeProgress } = require("../controllers/degreeProgress");
const {
  getDegreePlanner,
  addYeartoDegreeplanner,
  addDegreePlanTerm,
  removeDegreePlanTerm,
  saveDegreePlanCourse,
  removeDegreePlanCourse,
} = require("../controllers/degreePlanner");
const { listWalkingWarnings } = require("../controllers/walkingWarnings");
const { requireAuth } = require("../middleware/token");

const router = express.Router();

router.get("/calendar", requireAuth, getCalendar);
router.get("/degree-progress", requireAuth, getDegreeProgress);

router.get("/degree-planner", requireAuth, getDegreePlanner);
router.post("/degree-planner/years", requireAuth, addYeartoDegreeplanner);
router.post("/degree-planner/terms", requireAuth, addDegreePlanTerm);
router.delete("/degree-planner/terms/:planTermId", requireAuth, removeDegreePlanTerm);
router.post("/degree-planner/courses", requireAuth, saveDegreePlanCourse);
router.delete("/degree-planner/courses/:courseId", requireAuth, removeDegreePlanCourse);

router.get("/walking-warnings", requireAuth, listWalkingWarnings);

module.exports = router;
