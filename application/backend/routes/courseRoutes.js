const express = require("express");
const { listCourses } = require("../controllers/courses");

const router = express.Router();

router.get("/courses", listCourses);

module.exports = router;