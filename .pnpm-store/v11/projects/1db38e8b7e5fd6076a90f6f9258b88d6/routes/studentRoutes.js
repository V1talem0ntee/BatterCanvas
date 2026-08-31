const express = require("express");
const {
  getStudentProfile,
  listStudentSemesters,
  updateStudentProfile,
} = require("../controllers/studentProfile");
const { requireAuth } = require("../middleware/token");
const {
  listStudentMajorChangeData,
  createMajorChangeRequest,
  withdrawMajorChangeRequest,
} = require("../controllers/majorChangeRequests");

const router = express.Router();

router.get("/student/profile", requireAuth, getStudentProfile);
router.get("/student/semesters", requireAuth, listStudentSemesters);
router.patch("/student/profile", requireAuth, updateStudentProfile);
router.get("/student/major-change-requests", requireAuth, listStudentMajorChangeData);
router.post("/student/major-change-requests", requireAuth, createMajorChangeRequest);
router.delete("/student/major-change-requests/:requestId", requireAuth, withdrawMajorChangeRequest);

module.exports = router;
