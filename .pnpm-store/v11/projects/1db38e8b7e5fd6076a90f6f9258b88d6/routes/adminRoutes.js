const express = require("express");
const {
  createInvitation,
  listInvitations,
  deleteInvitation,
} = require("../controllers/admin");
const {
  updateStudentAcademicProfile,
} = require("../controllers/studentProfile");
const {
  createCourse,
  bulkImportCourses,
  updateCourse,
  deleteCourse,
  createSection,
  updateSection,
  deleteSection,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  generateBuildingDistances,
  createClassroom,
  createClassroomsForFloor,
  updateClassroom,
  deleteClassroom,
  createDegreeRequirement,
  updateDegreeRequirement,
  deleteDegreeRequirement,
  createDegreeProgram,
  updateDegreeProgram,
  deleteDegreeProgram,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createMajor,
  updateMajor,
  deleteMajor,
  setStudentCourseResult,
  deleteStudentCourseResult,
  dropStudentFromSection,
  createSemester,
  setActiveSemester,
  deleteSemester,
} = require("../controllers/adminManagement");
const { requireAdmin } = require("../middleware/token");
const adminData = require("../controllers/adminData");
const {
  listAdminMajorChangeRequests,
  reviewMajorChangeRequest,
} = require("../controllers/majorChangeRequests");
const { createAdminNotification } = require("../controllers/notifications");

const router = express.Router();

// Every endpoint in this module requires a verified administrator token.
// Dashboard and shared form-reference data.
router.get("/admin/dashboard", requireAdmin, adminData.getDashboard);
router.get("/admin/reference-data", requireAdmin, adminData.listReferenceData);

// Read-only resource lists and detail records.
router.get("/admin/students", requireAdmin, adminData.listStudents);
router.get("/admin/students/:studentId", requireAdmin, adminData.getStudent);
router.get("/admin/departments", requireAdmin, adminData.listDepartments);
router.get("/admin/majors", requireAdmin, adminData.listMajors);
router.get("/admin/courses", requireAdmin, adminData.listCourses);
router.get("/admin/courses/:courseId", requireAdmin, adminData.getCourse);
router.get("/admin/sections", requireAdmin, adminData.listSections);
router.get(
  "/admin/sections/:classSectionId",
  requireAdmin,
  adminData.getSection,
);
router.get("/admin/buildings", requireAdmin, adminData.listLocations);
router.get(
  "/admin/buildings/:buildingId/classroom-schedule",
  requireAdmin,
  adminData.getClassroomSchedule,
);
router.get("/admin/buildings/:buildingId", requireAdmin, adminData.getLocation);
router.get(
  "/admin/degree-programs",
  requireAdmin,
  adminData.listDegreePrograms,
);
router.get(
  "/admin/degree-programs/:degreeProgramId",
  requireAdmin,
  adminData.getDegreeProgram,
);

// Degree-program and requirement relationships.
router.post("/admin/degree-programs", requireAdmin, createDegreeProgram);
router.patch(
  "/admin/degree-programs/:degreeProgramId",
  requireAdmin,
  updateDegreeProgram,
);
router.delete(
  "/admin/degree-programs/:degreeProgramId",
  requireAdmin,
  deleteDegreeProgram,
);
router.get(
  "/admin/degree-requirements",
  requireAdmin,
  adminData.listDegreeRequirements,
);
router.get(
  "/admin/degree-requirements/:degreeRequirementId",
  requireAdmin,
  adminData.getDegreeRequirement,
);
router.put(
  "/admin/degree-requirements/:degreeRequirementId/courses/:courseId",
  requireAdmin,
  adminData.addRequirementCourse,
);
router.delete(
  "/admin/degree-requirements/:degreeRequirementId/courses/:courseId",
  requireAdmin,
  adminData.removeRequirementCourse,
);
router.put(
  "/admin/courses/:courseId/prerequisites/:prerequisiteCourseId",
  requireAdmin,
  adminData.addCoursePrerequisite,
);
router.delete(
  "/admin/courses/:courseId/prerequisites/:prerequisiteCourseId",
  requireAdmin,
  adminData.removeCoursePrerequisite,
);

// Invitation lifecycle and student academic-profile maintenance.
router.get("/admin/invitations", requireAdmin, listInvitations);
router.delete("/admin/invitations/:id", requireAdmin, deleteInvitation);
router.patch(
  "/admin/students/:studentId/profile",
  requireAdmin,
  updateStudentAcademicProfile,
);
router.get(
  "/admin/major-change-requests",
  requireAdmin,
  listAdminMajorChangeRequests,
);
router.patch(
  "/admin/major-change-requests/:requestId",
  requireAdmin,
  reviewMajorChangeRequest,
);
router.post("/admin/semesters", requireAdmin, createSemester);
router.patch(
  "/admin/semesters/:semesterId/active",
  requireAdmin,
  setActiveSemester,
);
router.delete("/admin/semesters/:semesterId", requireAdmin, deleteSemester);
router.put(
  "/admin/students/:studentId/results/:classSectionId",
  requireAdmin,
  setStudentCourseResult,
);
router.delete(
  "/admin/students/:studentId/results/:classSectionId",
  requireAdmin,
  deleteStudentCourseResult,
);
router.delete(
  "/admin/students/:studentId/sections/:classSectionId",
  requireAdmin,
  dropStudentFromSection,
);

// Admin notifications.
router.post("/admin/notifications", requireAdmin, createAdminNotification);

// Academic organization mutations.
router.post("/admin/departments", requireAdmin, createDepartment);
router.patch(
  "/admin/departments/:departmentId",
  requireAdmin,
  updateDepartment,
);
router.delete(
  "/admin/departments/:departmentId",
  requireAdmin,
  deleteDepartment,
);
router.post("/admin/majors", requireAdmin, createMajor);
router.patch("/admin/majors/:majorId", requireAdmin, updateMajor);
router.delete("/admin/majors/:majorId", requireAdmin, deleteMajor);

// Course catalog and scheduled-section mutations.
router.post("/admin/courses", requireAdmin, createCourse);
router.post("/admin/courses/import", requireAdmin, bulkImportCourses);
router.patch("/admin/courses/:courseId", requireAdmin, updateCourse);
router.delete("/admin/courses/:courseId", requireAdmin, deleteCourse);
router.post("/admin/courses/:courseId/sections", requireAdmin, createSection);
router.patch("/admin/sections/:classSectionId", requireAdmin, updateSection);
router.delete("/admin/sections/:classSectionId", requireAdmin, deleteSection);

// Campus location mutations.
router.post(
  "/admin/building-distances/generate",
  requireAdmin,
  generateBuildingDistances,
);
router.post("/admin/buildings", requireAdmin, createBuilding);
router.patch("/admin/buildings/:buildingId", requireAdmin, updateBuilding);
router.delete("/admin/buildings/:buildingId", requireAdmin, deleteBuilding);
router.post("/admin/classrooms", requireAdmin, createClassroom);
router.post(
  "/admin/buildings/:buildingId/classrooms/bulk",
  requireAdmin,
  createClassroomsForFloor,
);
router.patch("/admin/classrooms/:classroomId", requireAdmin, updateClassroom);
router.delete("/admin/classrooms/:classroomId", requireAdmin, deleteClassroom);

// Individual degree-requirement mutations.
router.post(
  "/admin/degree-requirements",
  requireAdmin,
  createDegreeRequirement,
);
router.patch(
  "/admin/degree-requirements/:degreeRequirementId",
  requireAdmin,
  updateDegreeRequirement,
);
router.delete(
  "/admin/degree-requirements/:degreeRequirementId",
  requireAdmin,
  deleteDegreeRequirement,
);

// Keep this legacy invitation route last because its dynamic :role segment
// would otherwise capture POST requests such as /admin/majors or /admin/courses.
router.post("/admin/:role", requireAdmin, createInvitation);

module.exports = router;
