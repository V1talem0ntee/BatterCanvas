const express = require("express");
const {
  listSemesters,
  listGeAreas,
  getSemester,
  listDepartments,
  listDepartmentCourses,
  listBuildings,
} = require("../controllers/catalog");

const router = express.Router();

router.get("/semesters", listSemesters);
router.get("/ge-areas", listGeAreas);
router.get("/semesters/:semesterId", getSemester);
router.get("/departments", listDepartments);
router.get("/departments/:departmentId/courses", listDepartmentCourses);
router.get("/buildings", listBuildings);

module.exports = router;
