const { pool } = require("../db");

// Read-only admin queries live here. Mutation handlers remain in
// adminManagement.js so database writes and validation stay separate.

function positiveId(value) {
  // Route and query parameters arrive as strings, so normalize them once.
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function text(value) {
  return String(value || "").trim();
}

function pagination(query) {
  const requestedPage = Number(query.page || 1);
  const requestedPageSize = Number(query.pageSize || 25);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  // Prevent one admin request from loading an unbounded database table.
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, 100)
    : 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function pageResponse(rows, total, page, pageSize) {
  // Keep pagination metadata identical across all admin lists.
  return {
    items: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total ? Math.ceil(total / pageSize) : 0,
    },
  };
}

function fail(res, error, message) {
  console.error(message, error.message);
  return res.status(500).json({ message });
}

async function getDashboard(req, res) {
  // Scalar subqueries return one summary row without loading source records.
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.student) AS active_students,
        (SELECT COUNT(*)::int FROM public.course) AS total_courses,
        (SELECT COUNT(*)::int FROM public.class_section) AS total_sections,
        (SELECT COUNT(*)::int FROM public.account_invitation WHERE claimed_at IS NULL) AS pending_invitations,
        (SELECT COUNT(*)::int FROM public.class_section WHERE section_status = 'open') AS open_sections,
        (SELECT COUNT(*)::int FROM public.class_section WHERE section_status = 'waitlist') AS waitlist_sections,
        (SELECT COUNT(*)::int FROM public.class_section WHERE section_status = 'closed') AS closed_sections,
        (SELECT COUNT(*)::int FROM public.class_section WHERE section_status = 'cancelled') AS cancelled_sections
    `);
    const row = result.rows[0];
    return res.json({
      statistics: {
        activeStudents: row.active_students,
        totalCourses: row.total_courses,
        totalSections: row.total_sections,
        pendingInvitations: row.pending_invitations,
        sectionsByStatus: {
          open: row.open_sections,
          waitlist: row.waitlist_sections,
          closed: row.closed_sections,
          cancelled: row.cancelled_sections,
        },
      },
    });
  } catch (error) {
    return fail(res, error, "Unable to load admin dashboard.");
  }
}

function studentRow(row) {
  // Translate database snake_case into the frontend's camelCase API contract.
  return {
    studentId: row.student_id,
    schoolStudentId: row.school_student_id,
    firstName: row.first_name,
    lastName: row.last_name,
    institutionalEmail: row.institutional_email,
    academicLevel: row.academic_level,
    studentType: row.student_type,
    totalCredits: row.total_credits,
    phoneNumber: row.phone_number,
    degreeProgram: row.degree_program_id ? {
      degreeProgramId: row.degree_program_id,
      majorName: row.major_name,
      degreeType: row.degree_type,
      catalogYear: row.catalog_year,
    } : null,
    expectedGraduationSemester: row.expected_graduation_semester_id ? {
      semesterId: row.expected_graduation_semester_id,
      year: row.graduation_year,
      type: row.graduation_term,
    } : null,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

const STUDENT_FROM = `
  FROM public.student s
  JOIN public.app_user u ON u.user_id = s.student_id
  LEFT JOIN public.degree_program dp ON dp.degree_program_id = s.degree_program_id
  LEFT JOIN public.major m ON m.major_id = dp.major_id
  LEFT JOIN public.semester sem ON sem.semester_id = s.expected_graduation_semester_id`;

async function listStudents(req, res) {
  // The count and page queries share filters so pagination totals stay correct.
  const { page, pageSize, offset } = pagination(req.query);
  const search = text(req.query.search).toLowerCase();
  const academicLevel = text(req.query.academicLevel);
  const studentType = text(req.query.studentType);
  const degreeProgramId = req.query.degreeProgramId ? positiveId(req.query.degreeProgramId) : null;
  if (req.query.degreeProgramId && !degreeProgramId) {
    return res.status(400).json({ message: "degreeProgramId must be a positive integer." });
  }
  const values = [];
  const where = [];
  // Every ? in a clause intentionally reuses one numbered parameter because
  // the search compares several columns with the same user-supplied value.
  const add = (clause, value) => { values.push(value); where.push(clause.replaceAll("?", `$${values.length}`)); };
  if (search) add("(LOWER(u.first_name || ' ' || u.last_name) LIKE ? OR LOWER(u.institutional_email) LIKE ? OR LOWER(s.school_student_id) LIKE ?)", `%${search}%`);
  if (academicLevel) add("s.academic_level = ?", academicLevel);
  if (studentType) add("s.student_type = ?", studentType);
  if (degreeProgramId) add("s.degree_program_id = ?", degreeProgramId);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const count = await pool.query(`SELECT COUNT(*)::int AS total ${STUDENT_FROM} ${whereSql}`, values);
    const listValues = [...values, pageSize, offset];
    const result = await pool.query(`
      SELECT s.*, u.first_name, u.last_name, u.institutional_email, u.created_at, u.last_login_at,
        m.major_name, dp.degree_type, dp.catalog_year,
        sem.term_year AS graduation_year, sem.term_type AS graduation_term
      ${STUDENT_FROM} ${whereSql}
      ORDER BY u.last_name, u.first_name, s.school_student_id
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, listValues);
    const response = pageResponse(result.rows.map(studentRow), count.rows[0].total, page, pageSize);
    return res.json({ students: response.items, pagination: response.pagination });
  } catch (error) {
    return fail(res, error, "Unable to load students.");
  }
}

async function getStudent(req, res) {
  const studentId = positiveId(req.params.studentId);
  if (!studentId) return res.status(400).json({ message: "A valid studentId is required." });
  try {
    const result = await pool.query(`
      SELECT s.*, u.first_name, u.last_name, u.institutional_email, u.created_at, u.last_login_at,
        m.major_name, dp.degree_type, dp.catalog_year,
        sem.term_year AS graduation_year, sem.term_type AS graduation_term
      ${STUDENT_FROM} WHERE s.student_id = $1`, [studentId]);
    if (!result.rows.length) return res.status(404).json({ message: "Student not found." });
    const [enrollments, selectedSections] = await Promise.all([pool.query(
      `SELECT e.class_section_id, e.enrollment_date, e.enrollment_status, e.grade,
        c.course_id, c.subject_code, c.course_number, c.course_title, c.course_units,
        cs.section_number, sem.term_year, sem.term_type
       FROM public.enrollment e
       JOIN public.class_section cs ON cs.class_section_id = e.class_section_id
       JOIN public.course c ON c.course_id = cs.course_id
       JOIN public.semester sem ON sem.semester_id = cs.semester_id
       WHERE e.student_id = $1
       ORDER BY sem.term_year DESC, sem.term_type, c.subject_code, c.course_number`,
      [studentId]
    ), pool.query(
      `SELECT cc.class_section_id, cc.added_date,
        c.course_id, c.subject_code, c.course_number, c.course_title, c.course_units,
        cs.section_number, sem.term_year, sem.term_type
       FROM public.class_cart cc
       JOIN public.class_section cs ON cs.class_section_id = cc.class_section_id
       JOIN public.course c ON c.course_id = cs.course_id
       JOIN public.semester sem ON sem.semester_id = cs.semester_id
       WHERE cc.student_id = $1
       ORDER BY sem.term_year DESC, sem.term_type, c.subject_code, c.course_number`,
      [studentId]
    )]);
    return res.json({
      student: {
        ...studentRow(result.rows[0]), enrollments: enrollments.rows.map((row) => ({
          classSectionId: row.class_section_id, courseId: row.course_id,
          subjectCode: row.subject_code, courseNumber: row.course_number,
          title: row.course_title, units: row.course_units,
          sectionNumber: row.section_number, termYear: row.term_year,
          termType: row.term_type, enrollmentDate: row.enrollment_date,
          status: row.enrollment_status, grade: row.grade,
          passed: row.enrollment_status === "completed" && Boolean(row.grade) && !["F", "NP"].includes(row.grade),
        })), selectedSections: selectedSections.rows.map((row) => ({
          classSectionId: row.class_section_id, courseId: row.course_id,
          subjectCode: row.subject_code, courseNumber: row.course_number,
          title: row.course_title, units: row.course_units,
          sectionNumber: row.section_number, termYear: row.term_year,
          termType: row.term_type, addedDate: row.added_date,
        }))
      }
    });
  } catch (error) {
    return fail(res, error, "Unable to load student.");
  }
}

async function listDepartments(req, res) {
  try {
    const result = await pool.query(`SELECT d.department_id, d.school_id, d.building_id, d.department_name,
      d.office_email, d.office_phone, s.school_name, b.building_name,
      COUNT(DISTINCT m.major_id)::int AS major_count, COUNT(DISTINCT c.course_id)::int AS course_count
      FROM public.department d JOIN public.school s ON s.school_id = d.school_id
      JOIN public.building b ON b.building_id = d.building_id
      LEFT JOIN public.major m ON m.department_id = d.department_id
      LEFT JOIN public.course c ON c.department_id = d.department_id
      GROUP BY d.department_id, s.school_name, b.building_name ORDER BY d.department_name`);
    return res.json({ departments: result.rows.map((r) => ({ departmentId: r.department_id, schoolId: r.school_id, schoolName: r.school_name, buildingId: r.building_id, buildingName: r.building_name, name: r.department_name, officeEmail: r.office_email, officePhone: r.office_phone, majorCount: r.major_count, courseCount: r.course_count })) });
  } catch (error) { return fail(res, error, "Unable to load departments."); }
}

async function listMajors(req, res) {
  const departmentId = req.query.departmentId ? positiveId(req.query.departmentId) : null;
  if (req.query.departmentId && !departmentId) return res.status(400).json({ message: "departmentId must be a positive integer." });
  try {
    const values = departmentId ? [departmentId] : [];
    const result = await pool.query(`SELECT m.major_id, m.department_id, m.major_name, d.department_name,
      COUNT(dp.degree_program_id)::int AS program_count FROM public.major m
      JOIN public.department d ON d.department_id = m.department_id
      LEFT JOIN public.degree_program dp ON dp.major_id = m.major_id
      ${departmentId ? "WHERE m.department_id = $1" : ""}
      GROUP BY m.major_id, d.department_name ORDER BY d.department_name, m.major_name`, values);
    return res.json({ majors: result.rows.map((r) => ({ majorId: r.major_id, departmentId: r.department_id, departmentName: r.department_name, name: r.major_name, programCount: r.program_count })) });
  } catch (error) { return fail(res, error, "Unable to load majors."); }
}

function courseRow(row) {
  // Response mapping keeps database column names out of React components.
  return {
    courseId: row.course_id,
    departmentId: row.department_id,
    departmentName: row.department_name,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    description: row.course_description,
    units: row.course_units,
    level: row.course_level,
    repeatable: row.repeatable,
    sectionType: row.section_type,
    category: row.course_category || ((row.ge_area_ids || []).length ? "ge" : "major-core"),
    geAreaId: row.ge_area_ids?.[0] || null,
    geAreas: (row.ge_area_ids || []).map((id, index) => ({ geAreaId: id, code: row.ge_area_codes[index] })),
    sectionCount: row.section_count === undefined ? undefined : row.section_count,
  };
}

async function listCourses(req, res) {
  // Search accepts either a course code or words from the course title.
  const { page, pageSize, offset } = pagination(req.query);
  const search = text(req.query.search).toLowerCase();
  const subjectCode = text(req.query.subjectCode).toLowerCase();
  const departmentId = req.query.departmentId ? positiveId(req.query.departmentId) : null;
  if (req.query.departmentId && !departmentId) return res.status(400).json({ message: "departmentId must be a positive integer." });
  const values = [];
  const where = [];
  if (search) { values.push(`%${search}%`); where.push(`(LOWER(c.subject_code || ' ' || c.course_number) LIKE $1 OR LOWER(c.course_title) LIKE $1)`); }
  if (subjectCode) { values.push(subjectCode); where.push(`LOWER(c.subject_code) = $${values.length}`); }
  if (departmentId) { values.push(departmentId); where.push(`c.department_id = $${values.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM public.course c ${whereSql}`, values);
    const result = await pool.query(`
      SELECT c.*, d.department_name, COUNT(cs.class_section_id)::int AS section_count,
        ARRAY(SELECT cga.ge_area_id FROM public.course_ge_area cga WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_ids,
        ARRAY(SELECT ga.ge_area_code FROM public.course_ge_area cga JOIN public.ge_area ga ON ga.ge_area_id = cga.ge_area_id WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_codes
      FROM public.course c JOIN public.department d ON d.department_id = c.department_id
      LEFT JOIN public.class_section cs ON cs.course_id = c.course_id
      ${whereSql} GROUP BY c.course_id, d.department_name
      ORDER BY c.subject_code, c.course_number
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, offset]);
    const response = pageResponse(result.rows.map(courseRow), count.rows[0].total, page, pageSize);
    return res.json({ courses: response.items, pagination: response.pagination });
  } catch (error) { return fail(res, error, "Unable to load admin courses."); }
}

async function getCourse(req, res) {
  const courseId = positiveId(req.params.courseId);
  if (!courseId) return res.status(400).json({ message: "A valid courseId is required." });
  try {
    const result = await pool.query(`SELECT c.*, d.department_name,
      ARRAY(SELECT cga.ge_area_id FROM public.course_ge_area cga WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_ids,
      ARRAY(SELECT ga.ge_area_code FROM public.course_ge_area cga JOIN public.ge_area ga ON ga.ge_area_id = cga.ge_area_id WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_codes
      FROM public.course c JOIN public.department d ON d.department_id = c.department_id WHERE c.course_id = $1`, [courseId]);
    if (!result.rows.length) return res.status(404).json({ message: "Course not found." });
    const prerequisites = await pool.query(
      `SELECT cp.prerequisite_course_id, cp.minimum_grade,
        c.subject_code, c.course_number, c.course_title, c.course_units
       FROM public.course_prerequisite cp
       JOIN public.course c ON c.course_id = cp.prerequisite_course_id
       WHERE cp.course_id = $1 ORDER BY c.subject_code, c.course_number`,
      [courseId]
    );
    return res.json({
      course: {
        ...courseRow(result.rows[0]), prerequisites: prerequisites.rows.map((r) => ({
          courseId: r.prerequisite_course_id, subjectCode: r.subject_code,
          courseNumber: r.course_number, title: r.course_title,
          units: r.course_units, minimumGrade: r.minimum_grade,
        }))
      }
    });
  } catch (error) { return fail(res, error, "Unable to load admin course."); }
}

function sectionRow(row) {
  // Meeting days are returned as an ordered array assembled by PostgreSQL.
  return {
    classSectionId: row.class_section_id, courseId: row.course_id,
    courseCode: `${row.subject_code} ${row.course_number}`, courseTitle: row.course_title,
    semesterId: row.semester_id, termYear: row.term_year, termType: row.term_type,
    classroomId: row.classroom_id, buildingName: row.building_name, roomNumber: row.room_number,
    instructorId: row.instructor_id, instructorName: `${row.instructor_first_name} ${row.instructor_last_name}`,
    sectionNumber: row.section_number, startDate: row.start_date, endDate: row.end_date,
    meetingStartTime: row.meeting_start_time, meetingEndTime: row.meeting_end_time,
    meetingDays: row.meeting_days || [], modality: row.modality, meetingType: row.meeting_type,
    capacity: row.capacity, enrolledCount: row.enrolled_count,
    waitlistCapacity: row.waitlist_capacity, waitlistCount: row.waitlist_count, status: row.section_status,
  };
}

const SECTION_FROM = `FROM public.class_section cs JOIN public.course c ON c.course_id = cs.course_id
  JOIN public.semester sem ON sem.semester_id = cs.semester_id JOIN public.instructor i ON i.instructor_id = cs.instructor_id
  LEFT JOIN public.classroom cr ON cr.classroom_id = cs.classroom_id LEFT JOIN public.building b ON b.building_id = cr.building_id`;
const SECTION_SELECT = `SELECT cs.*, c.subject_code, c.course_number, c.course_title, sem.term_year, sem.term_type,
  i.first_name AS instructor_first_name, i.last_name AS instructor_last_name, b.building_name, cr.room_number,
  ARRAY(SELECT md.day_of_week FROM public.meeting_day md WHERE md.class_section_id = cs.class_section_id ORDER BY CASE md.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END) AS meeting_days`;

async function listSections(req, res) {
  // Optional filters are added while preserving SQL placeholder order.
  const { page, pageSize, offset } = pagination(req.query);
  const ids = ["courseId", "semesterId", "instructorId"].map((key) => [key, req.query[key] ? positiveId(req.query[key]) : null]);
  const invalid = ids.find(([key, value]) => req.query[key] && !value);
  if (invalid) return res.status(400).json({ message: `${invalid[0]} must be a positive integer.` });
  const values = []; const where = [];
  for (const [key, value] of ids) if (value) { values.push(value); where.push(`cs.${key === "courseId" ? "course_id" : key === "semesterId" ? "semester_id" : "instructor_id"} = $${values.length}`); }
  if (req.query.status) { values.push(text(req.query.status)); where.push(`cs.section_status = $${values.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const count = await pool.query(`SELECT COUNT(*)::int AS total ${SECTION_FROM} ${whereSql}`, values);
    const result = await pool.query(`${SECTION_SELECT} ${SECTION_FROM} ${whereSql} ORDER BY sem.term_year DESC, c.subject_code, c.course_number, cs.section_number LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    const response = pageResponse(result.rows.map(sectionRow), count.rows[0].total, page, pageSize);
    return res.json({ sections: response.items, pagination: response.pagination });
  } catch (error) { return fail(res, error, "Unable to load admin sections."); }
}

async function getSection(req, res) {
  const id = positiveId(req.params.classSectionId);
  if (!id) return res.status(400).json({ message: "A valid classSectionId is required." });
  try {
    const result = await pool.query(`${SECTION_SELECT} ${SECTION_FROM} WHERE cs.class_section_id = $1`, [id]);
    if (!result.rows.length) return res.status(404).json({ message: "Class section not found." });
    return res.json({ section: sectionRow(result.rows[0]) });
  } catch (error) { return fail(res, error, "Unable to load class section."); }
}

async function listLocations(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        b.building_id,
        b.school_id,
        b.building_name,
        b.map_element_id,
        b.latitude,
        b.longitude,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT bt.building_type), NULL) AS types,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'classroomId', cr.classroom_id,
              'roomNumber', cr.room_number
            )
            ORDER BY cr.room_number
          ) FILTER (WHERE cr.classroom_id IS NOT NULL),
          '[]'
        ) AS classrooms
       FROM public.building b
       LEFT JOIN public.building_type bt
         ON bt.building_id = b.building_id
       LEFT JOIN public.classroom cr
         ON cr.building_id = b.building_id
       GROUP BY b.building_id
       ORDER BY b.building_name`
    );

    return res.json({
      buildings: result.rows.map((r) => ({
        buildingId: r.building_id,
        schoolId: r.school_id,
        name: r.building_name,
        buildingName: r.building_name,
        mapElementId: r.map_element_id,
        latitude: r.latitude,
        longitude: r.longitude,
        types: r.types || [],
        classrooms: r.classrooms || [],
      })),
    });
  } catch (error) {
    return fail(res, error, "Unable to load admin locations.");
  }
}

async function getLocation(req, res) {
  const id = positiveId(req.params.buildingId);

  if (!id) {
    return res.status(400).json({
      message: "A valid buildingId is required.",
    });
  }

  req.query = req.query || {};

  try {
    const result = await pool.query(
      `SELECT
        b.building_id,
        b.school_id,
        b.building_name,
        b.map_element_id,
        b.latitude,
        b.longitude,
        ARRAY(
          SELECT bt.building_type
          FROM public.building_type bt
          WHERE bt.building_id = b.building_id
          ORDER BY bt.building_type
        ) AS types,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'classroomId', cr.classroom_id,
                'roomNumber', cr.room_number
              )
              ORDER BY cr.room_number
            )
            FROM public.classroom cr
            WHERE cr.building_id = b.building_id
          ),
          '[]'
        ) AS classrooms
       FROM public.building b
       WHERE b.building_id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Building not found.",
      });
    }

    const r = result.rows[0];

    return res.json({
      building: {
        buildingId: r.building_id,
        schoolId: r.school_id,
        name: r.building_name,
        buildingName: r.building_name,
        mapElementId: r.map_element_id,
        latitude: r.latitude,
        longitude: r.longitude,
        types: r.types || [],
        classrooms: r.classrooms || [],
      },
    });
  } catch (error) {
    return fail(res, error, "Unable to load building.");
  }
}

async function getClassroomSchedule(req, res) {
  const buildingId = positiveId(req.params.buildingId);
  const semesterId = positiveId(req.query.semesterId);
  if (!buildingId || !semesterId) {
    return res.status(400).json({ message: "Valid buildingId and semesterId values are required." });
  }
  try {
    const result = await pool.query(
      `SELECT cr.classroom_id, cr.room_number, cs.class_section_id,
        cs.meeting_start_time, cs.meeting_end_time,
        c.subject_code, c.course_number, cs.section_number,
        ARRAY(SELECT md.day_of_week FROM public.meeting_day md
          WHERE md.class_section_id = cs.class_section_id) AS meeting_days
       FROM public.classroom cr
       LEFT JOIN public.class_section cs
         ON cs.classroom_id = cr.classroom_id
        AND cs.semester_id = $2
        AND cs.section_status <> 'cancelled'
       LEFT JOIN public.course c ON c.course_id = cs.course_id
       WHERE cr.building_id = $1
       ORDER BY cr.room_number, cs.meeting_start_time`,
      [buildingId, semesterId]
    );
    const classrooms = new Map();
    for (const row of result.rows) {
      if (!classrooms.has(row.classroom_id)) {
        classrooms.set(row.classroom_id, {
          classroomId: row.classroom_id,
          roomNumber: row.room_number,
          bookings: [],
        });
      }
      if (row.class_section_id) {
        classrooms.get(row.classroom_id).bookings.push({
          classSectionId: row.class_section_id,
          courseCode: `${row.subject_code} ${row.course_number}`,
          sectionNumber: row.section_number,
          meetingDays: row.meeting_days || [],
          startTime: row.meeting_start_time,
          endTime: row.meeting_end_time,
        });
      }
    }
    return res.json({ classrooms: Array.from(classrooms.values()) });
  } catch (error) {
    return fail(res, error, "Unable to load classroom schedule.");
  }
}

function programRow(r) {
  return { degreeProgramId: r.degree_program_id, majorId: r.major_id, majorName: r.major_name, departmentId: r.department_id, departmentName: r.department_name, degreeType: r.degree_type, catalogYear: r.catalog_year, requiredMajorUnits: r.required_major_units, requiredGeUnits: r.required_ge_units, requirementCount: r.requirement_count === undefined ? undefined : r.requirement_count };
}

async function listDegreePrograms(req, res) {
  // Counts summarize requirements without loading their complete course lists.
  try {
    const result = await pool.query(`SELECT dp.*, m.major_name, m.department_id, d.department_name, COUNT(dr.degree_requirement_id)::int AS requirement_count
      FROM public.degree_program dp JOIN public.major m ON m.major_id = dp.major_id JOIN public.department d ON d.department_id = m.department_id
      LEFT JOIN public.degree_requirement dr ON dr.degree_program_id = dp.degree_program_id GROUP BY dp.degree_program_id, m.major_name, m.department_id, d.department_name
      ORDER BY m.major_name, dp.catalog_year DESC, dp.degree_type`);
    return res.json({ degreePrograms: result.rows.map(programRow) });
  } catch (error) { return fail(res, error, "Unable to load degree programs."); }
}

async function getDegreeProgram(req, res) {
  const id = positiveId(req.params.degreeProgramId);
  if (!id) return res.status(400).json({ message: "A valid degreeProgramId is required." });
  try {
    const program = await pool.query(`SELECT dp.*, m.major_name, m.department_id, d.department_name FROM public.degree_program dp JOIN public.major m ON m.major_id = dp.major_id JOIN public.department d ON d.department_id = m.department_id WHERE dp.degree_program_id = $1`, [id]);
    if (!program.rows.length) return res.status(404).json({ message: "Degree program not found." });
    const requirements = await loadRequirements("WHERE dr.degree_program_id = $1", [id]);
    return res.json({ degreeProgram: { ...programRow(program.rows[0]), requirements } });
  } catch (error) { return fail(res, error, "Unable to load degree program."); }
}

function requirementRow(r) {
  return { degreeRequirementId: r.degree_requirement_id, degreeProgramId: r.degree_program_id, geAreaId: r.ge_area_id, geAreaCode: r.ge_area_code, name: r.requirement_name, type: r.requirement_type, completionRule: r.completion_rule, requiredUnits: r.required_units, minimumGrade: r.minimum_grade, courses: r.courses || [] };
}

async function loadRequirements(where = "", values = []) {
  // Shared loader supports all requirements, one program, or one requirement.
  const result = await pool.query(`SELECT dr.*, ga.ge_area_code,
    COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT('courseId', c.course_id, 'subjectCode', c.subject_code, 'courseNumber', c.course_number, 'title', c.course_title, 'units', c.course_units) ORDER BY c.subject_code, c.course_number) FROM public.required_course rc JOIN public.course c ON c.course_id = rc.course_id WHERE rc.requirement_id = dr.degree_requirement_id), '[]') AS courses
    FROM public.degree_requirement dr LEFT JOIN public.ge_area ga ON ga.ge_area_id = dr.ge_area_id ${where} ORDER BY dr.requirement_type, dr.requirement_name`, values);
  return result.rows.map(requirementRow);
}

async function listDegreeRequirements(req, res) {
  const programId = req.query.degreeProgramId ? positiveId(req.query.degreeProgramId) : null;
  if (req.query.degreeProgramId && !programId) return res.status(400).json({ message: "degreeProgramId must be a positive integer." });
  try { return res.json({ degreeRequirements: await loadRequirements(programId ? "WHERE dr.degree_program_id = $1" : "", programId ? [programId] : []) }); }
  catch (error) { return fail(res, error, "Unable to load degree requirements."); }
}

async function getDegreeRequirement(req, res) {
  const id = positiveId(req.params.degreeRequirementId);
  if (!id) return res.status(400).json({ message: "A valid degreeRequirementId is required." });
  try {
    const items = await loadRequirements("WHERE dr.degree_requirement_id = $1", [id]);
    if (!items.length) return res.status(404).json({ message: "Degree requirement not found." });
    return res.json({ degreeRequirement: items[0] });
  } catch (error) { return fail(res, error, "Unable to load degree requirement."); }
}

async function listReferenceData(req, res) {
  // Admin forms share these select options instead of duplicating lookup calls.
  try {
    const [schools, buildings, departments, semesters, instructors, majors, geAreas, classrooms] = await Promise.all([
      pool.query("SELECT school_id, school_name FROM public.school ORDER BY school_name"),
      pool.query("SELECT building_id, school_id, building_name FROM public.building ORDER BY building_name"),
      pool.query("SELECT department_id, department_name, school_id FROM public.department ORDER BY department_name"),
      pool.query("SELECT semester_id, term_year, term_type, start_date, end_date, is_active FROM public.semester ORDER BY term_year DESC, term_type"),
      pool.query("SELECT instructor_id, first_name, last_name, institutional_email FROM public.instructor ORDER BY last_name, first_name"),
      pool.query("SELECT major_id, department_id, major_name FROM public.major ORDER BY major_name"),
      pool.query("SELECT ge_area_id, ge_area_code, ge_area_name FROM public.ge_area ORDER BY ge_area_code"),
      pool.query("SELECT cr.classroom_id, cr.building_id, cr.room_number, b.building_name FROM public.classroom cr JOIN public.building b ON b.building_id = cr.building_id ORDER BY b.building_name, cr.room_number"),
    ]);
    return res.json({
      schools: schools.rows.map((r) => ({ schoolId: r.school_id, name: r.school_name })),
      buildings: buildings.rows.map((r) => ({ buildingId: r.building_id, schoolId: r.school_id, name: r.building_name })),
      departments: departments.rows.map((r) => ({ departmentId: r.department_id, schoolId: r.school_id, name: r.department_name })),
      semesters: semesters.rows.map((r) => ({ semesterId: r.semester_id, year: r.term_year, type: r.term_type, startDate: r.start_date, endDate: r.end_date, isActive: r.is_active })),
      instructors: instructors.rows.map((r) => ({ instructorId: r.instructor_id, firstName: r.first_name, lastName: r.last_name, institutionalEmail: r.institutional_email })),
      majors: majors.rows.map((r) => ({ majorId: r.major_id, departmentId: r.department_id, name: r.major_name })),
      geAreas: geAreas.rows.map((r) => ({ geAreaId: r.ge_area_id, code: r.ge_area_code, name: r.ge_area_name })),
      classrooms: classrooms.rows.map((r) => ({ classroomId: r.classroom_id, buildingId: r.building_id, buildingName: r.building_name, roomNumber: r.room_number })),
    });
  } catch (error) { return fail(res, error, "Unable to load admin reference data."); }
}

async function addRequirementCourse(req, res) {
  const requirementId = positiveId(req.params.degreeRequirementId);
  const courseId = positiveId(req.params.courseId);
  if (!requirementId || !courseId) return res.status(400).json({ message: "Valid degreeRequirementId and courseId are required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const requirement = await client.query(
      `SELECT dr.degree_program_id
       FROM public.degree_requirement dr
       JOIN public.degree_program dp ON dp.degree_program_id = dr.degree_program_id
       WHERE dr.degree_requirement_id = $1
       FOR UPDATE OF dp`,
      [requirementId]
    );
    if (!requirement.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Degree requirement not found." });
    }

    const existing = await client.query(
      `SELECT dr.requirement_name
       FROM public.required_course rc
       JOIN public.degree_requirement dr ON dr.degree_requirement_id = rc.requirement_id
       WHERE dr.degree_program_id = $1
         AND rc.course_id = $2
         AND dr.degree_requirement_id <> $3
       LIMIT 1`,
      [requirement.rows[0].degree_program_id, courseId, requirementId]
    );
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: `This course is already assigned to the ${existing.rows[0].requirement_name} requirement in this degree program.`,
      });
    }

    const result = await client.query(
      `INSERT INTO public.required_course (requirement_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING requirement_id`,
      [requirementId, courseId]
    );
    await client.query("COMMIT");
    return res.status(result.rows.length ? 201 : 200).json({ degreeRequirementId: requirementId, courseId });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23503") return res.status(404).json({ message: "Degree requirement or course not found." });
    return fail(res, error, "Unable to associate course with degree requirement.");
  } finally { client.release(); }
}

async function removeRequirementCourse(req, res) {
  const requirementId = positiveId(req.params.degreeRequirementId);
  const courseId = positiveId(req.params.courseId);
  if (!requirementId || !courseId) return res.status(400).json({ message: "Valid degreeRequirementId and courseId are required." });
  try {
    const result = await pool.query("DELETE FROM public.required_course WHERE requirement_id = $1 AND course_id = $2 RETURNING requirement_id", [requirementId, courseId]);
    if (!result.rows.length) return res.status(404).json({ message: "Course association not found." });
    return res.status(204).send();
  } catch (error) { return fail(res, error, "Unable to remove course from degree requirement."); }
}

async function addCoursePrerequisite(req, res) {
  const courseId = positiveId(req.params.courseId);
  const prerequisiteCourseId = positiveId(req.params.prerequisiteCourseId);
  const minimumGrade = text(req.body.minimumGrade) || null;
  if (!courseId || !prerequisiteCourseId || courseId === prerequisiteCourseId) {
    return res.status(400).json({ message: "Valid, different course IDs are required." });
  }
  try {
    await pool.query(
      `INSERT INTO public.course_prerequisite
       (course_id, prerequisite_course_id, minimum_grade)
       VALUES ($1, $2, $3)
       ON CONFLICT (course_id, prerequisite_course_id)
       DO UPDATE SET minimum_grade = EXCLUDED.minimum_grade`,
      [courseId, prerequisiteCourseId, minimumGrade]
    );
    return res.status(201).json({ courseId, prerequisiteCourseId, minimumGrade });
  } catch (error) {
    if (error.code === "23503") return res.status(404).json({ message: "Course not found." });
    return fail(res, error, "Unable to save course prerequisite.");
  }
}

async function removeCoursePrerequisite(req, res) {
  const courseId = positiveId(req.params.courseId);
  const prerequisiteCourseId = positiveId(req.params.prerequisiteCourseId);
  if (!courseId || !prerequisiteCourseId) return res.status(400).json({ message: "Valid course IDs are required." });
  try {
    const result = await pool.query(
      `DELETE FROM public.course_prerequisite
       WHERE course_id = $1 AND prerequisite_course_id = $2
       RETURNING course_id`,
      [courseId, prerequisiteCourseId]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Prerequisite not found." });
    return res.status(204).send();
  } catch (error) { return fail(res, error, "Unable to remove course prerequisite."); }
}

module.exports = {
  getDashboard, listStudents, getStudent, listDepartments, listMajors, listCourses, getCourse, listSections, getSection,
  listLocations, getLocation, getClassroomSchedule, listDegreePrograms, getDegreeProgram, listDegreeRequirements, getDegreeRequirement,
  listReferenceData, addRequirementCourse, removeRequirementCourse,
  addCoursePrerequisite, removeCoursePrerequisite
};
