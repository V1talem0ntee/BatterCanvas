const { pool } = require("../db");

// Route parameters arrive as strings. Return null for invalid identifiers so
// every controller can use the same validation rule.
function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function requireStudent(req, res) {
  if (req.auth.role !== "student") {
    res.status(403).json({ message: "Student access required." });
    return false;
  }

  return true;
}

// Planned Schedule works at the course level. Section-specific fields such as
// instructor, meeting time, and classroom are selected later during enrollment.
function plannedCourseRow(row) {
  return {
    courseId: row.course_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    description: row.course_description,
    units: row.course_units,
    semesterId: row.semester_id,
    termYear: row.term_year,
    termType: row.term_type,
    addedDate: row.added_date,
  };
}

// A student may plan the same course in different semesters, so both IDs are
// needed to identify a single planned-course record.
async function plannedCourseExists(client, studentId, courseId, semesterId) {
  const result = await client.query(
    `SELECT 1
     FROM public.planned_course
     WHERE student_id = $1
       AND course_id = $2
       AND semester_id = $3`,
    [studentId, courseId, semesterId]
  );

  return result.rows.length > 0;
}

// Validate foreign-key references before writing so the API can return a clear
// 404 response instead of exposing a database constraint error.
async function validateCourseAndSemester(client, courseId, semesterId) {
  const result = await client.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM public.course WHERE course_id = $1
       ) AS course_exists,
       EXISTS (
         SELECT 1 FROM public.semester WHERE semester_id = $2
       ) AS semester_exists`,
    [courseId, semesterId]
  );

  return result.rows[0];
}

async function isActiveSemester(client, semesterId) {
  const result = await client.query(
    "SELECT is_active FROM public.semester WHERE semester_id = $1",
    [semesterId]
  );
  return Boolean(result.rows[0]?.is_active);
}

/** Returns the authenticated student's courses ordered by academic semester. */
async function listPlannedCourses(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         pc.added_date,
         c.course_id,
         c.subject_code,
         c.course_number,
         c.course_title,
         c.course_description,
         c.course_units,
         s.semester_id,
         s.term_year,
         s.term_type
       FROM public.planned_course pc
       JOIN public.course c
         ON c.course_id = pc.course_id
       JOIN public.semester s
         ON s.semester_id = pc.semester_id
       WHERE pc.student_id = $1
       ORDER BY
         s.term_year,
         CASE s.term_type
           WHEN 'Winter' THEN 1
           WHEN 'Spring' THEN 2
           WHEN 'Summer' THEN 3
           WHEN 'Fall' THEN 4
         END,
         c.subject_code,
         c.course_number`,
      [req.auth.userId]
    );

    return res.json({ plannedCourses: result.rows.map(plannedCourseRow) });
  } catch (error) {
    console.error("Unable to load planned courses:", error.message);
    return res.status(500).json({ message: "Unable to load planned courses." });
  }
}

/** Adds a course to one semester without creating duplicate plan records. */
async function addPlannedCourse(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const courseId = cleanId(req.body.courseId);
  const semesterId = cleanId(req.body.semesterId);

  if (!courseId || !semesterId) {
    return res.status(400).json({
      message: "Valid courseId and semesterId values are required.",
    });
  }

  const client = await pool.connect();

  try {
    const references = await validateCourseAndSemester(
      client,
      courseId,
      semesterId
    );

    if (!references.course_exists) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (!references.semester_exists) {
      return res.status(404).json({ message: "Semester not found." });
    }
    if (!(await isActiveSemester(client, semesterId))) {
      return res.status(409).json({ message: "This semester is view-only because it is not the active semester.", code: "SEMESTER_NOT_ACTIVE" });
    }

    const result = await client.query(
      `INSERT INTO public.planned_course
       (student_id, course_id, semester_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, course_id, semester_id)
       DO NOTHING
       RETURNING student_id, course_id, semester_id, added_date`,
      [req.auth.userId, courseId, semesterId]
    );

    if (!result.rows.length) {
      return res.status(200).json({
        message: "Course is already in the study plan for this semester.",
        plannedCourse: { courseId, semesterId },
      });
    }

    return res.status(201).json({
      message: "Course added to the study plan.",
      plannedCourse: {
        courseId,
        semesterId,
        addedDate: result.rows[0].added_date,
      },
    });
  } catch (error) {
    console.error("Unable to add planned course:", error.message);
    return res.status(500).json({ message: "Unable to add planned course." });
  } finally {
    client.release();
  }
}

/** Moves a planned course while keeping the original added date. */
async function movePlannedCourse(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const courseId = cleanId(req.params.courseId);
  const semesterId = cleanId(req.params.semesterId);
  const targetSemesterId = cleanId(req.body.targetSemesterId);

  if (!courseId || !semesterId || !targetSemesterId) {
    return res.status(400).json({
      message: "Valid courseId, semesterId, and targetSemesterId values are required.",
    });
  }

  if (semesterId === targetSemesterId) {
    return res.status(400).json({
      message: "The target semester must be different from the current semester.",
    });
  }

  const client = await pool.connect();

  try {
    // Checking the destination and moving the record must succeed or fail as
    // one operation, so another request cannot create an inconsistent plan.
    await client.query("BEGIN");

    const references = await validateCourseAndSemester(
      client,
      courseId,
      targetSemesterId
    );

    if (!references.course_exists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Course not found." });
    }

    if (!references.semester_exists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Target semester not found." });
    }
    if (!(await isActiveSemester(client, semesterId)) || !(await isActiveSemester(client, targetSemesterId))) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Courses can only be changed within the active semester.", code: "SEMESTER_NOT_ACTIVE" });
    }

    if (
      await plannedCourseExists(
        client,
        req.auth.userId,
        courseId,
        targetSemesterId
      )
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Course is already planned for the target semester.",
      });
    }

    const result = await client.query(
      `UPDATE public.planned_course
       SET semester_id = $4
       WHERE student_id = $1
         AND course_id = $2
         AND semester_id = $3
       RETURNING course_id, semester_id, added_date`,
      [req.auth.userId, courseId, semesterId, targetSemesterId]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Planned course not found in the specified semester.",
      });
    }

    await client.query("COMMIT");
    return res.json({
      message: "Course moved to the target semester.",
      plannedCourse: {
        courseId,
        semesterId: targetSemesterId,
        addedDate: result.rows[0].added_date,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Unable to move planned course:", error.message);
    return res.status(500).json({ message: "Unable to move planned course." });
  } finally {
    client.release();
  }
}

/** Removes one course from one semester in the authenticated student's plan. */
async function removePlannedCourse(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const courseId = cleanId(req.params.courseId);
  const semesterId = cleanId(req.params.semesterId);

  if (!courseId || !semesterId) {
    return res.status(400).json({
      message: "Valid courseId and semesterId values are required.",
    });
  }

  try {
    if (!(await isActiveSemester(pool, semesterId))) {
      return res.status(409).json({ message: "This semester is view-only because it is not the active semester.", code: "SEMESTER_NOT_ACTIVE" });
    }
    const result = await pool.query(
      `DELETE FROM public.planned_course
       WHERE student_id = $1
         AND course_id = $2
         AND semester_id = $3
       RETURNING student_id`,
      [req.auth.userId, courseId, semesterId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Planned course not found in the specified semester.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Unable to remove planned course:", error.message);
    return res.status(500).json({ message: "Unable to remove planned course." });
  }
}

module.exports = {
  listPlannedCourses,
  addPlannedCourse,
  movePlannedCourse,
  removePlannedCourse,
};
