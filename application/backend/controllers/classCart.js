const { pool } = require("../db");

const MAX_CART_COURSES = 4;
const MAX_CART_UNITS = 15;

const GRADE_RANK = {
  F: 0,
  NP: 0,
  "D-": 1,
  D: 2,
  "D+": 3,
  "C-": 4,
  C: 5,
  P: 5,
  "C+": 6,
  "B-": 7,
  B: 8,
  "B+": 9,
  "A-": 10,
  A: 11,
};

function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cartLoadErrors(courseCount, totalUnits, newCourseUnits) {
  const errors = [];
  if (Number(courseCount) >= MAX_CART_COURSES) {
    errors.push({
      code: "CART_COURSE_LIMIT",
      message: `A student may add at most ${MAX_CART_COURSES} courses per semester.`,
    });
  }
  if (Number(totalUnits) + Number(newCourseUnits) > MAX_CART_UNITS) {
    errors.push({
      code: "CART_UNIT_LIMIT",
      message: `A student may add at most ${MAX_CART_UNITS} units per semester.`,
    });
  }
  return errors;
}

function requireStudent(req, res) {
  if (req.auth.role !== "student") {
    res.status(403).json({
      message: "Student access required.",
    });
    return false;
  }

  return true;
}

function meetsMinimumGrade(grade, minimumGrade) {
  if (!grade || ["F", "NP"].includes(String(grade).toUpperCase())) return false;
  if (!minimumGrade) return true;

  const gradeRank = GRADE_RANK[String(grade).toUpperCase()];
  const minimumRank = GRADE_RANK[String(minimumGrade).toUpperCase()];

  if (gradeRank === undefined || minimumRank === undefined) {
    return true;
  }

  return gradeRank >= minimumRank;
}

function minutesBetween(startTime, endTime) {
  const [startHour, startMinute] = String(startTime).split(":").map(Number);
  const [endHour, endMinute] = String(endTime).split(":").map(Number);

  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function cartSectionRow(row) {
  return {
    classSectionId: row.class_section_id,
    courseId: row.course_id,
    semesterId: row.semester_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    units: row.course_units,
    sectionNumber: row.section_number,
    modality: row.modality,
    meetingType: row.meeting_type,
    status: row.section_status,
    capacity: row.capacity,
    enrolledCount: row.enrolled_count,
    availableSeats: row.capacity - row.enrolled_count,
    meetingStartTime: row.meeting_start_time,
    meetingEndTime: row.meeting_end_time,
    meetingDays: row.meeting_days || [],
    instructor: {
      firstName: row.instructor_first_name,
      lastName: row.instructor_last_name,
    },
    location: row.building_name
      ? {
          buildingId: row.building_id,
          buildingName: row.building_name,
          roomNumber: row.room_number,
          mapElementId: row.map_element_id,
        }
      : null,
    addedDate: row.added_date,
  };
}

function sectionSummary(row) {
  return {
    classSectionId: row.class_section_id,
    courseId: row.course_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    sectionNumber: row.section_number,
    meetingStartTime: row.meeting_start_time,
    meetingEndTime: row.meeting_end_time,
    meetingDays: row.meeting_days || [],
    location: row.building_id
      ? {
          buildingId: row.building_id,
          buildingName: row.building_name,
          roomNumber: row.room_number,
          mapElementId: row.map_element_id,
        }
      : null,
  };
}

async function getSection(client, classSectionId) {
  const result = await client.query(
    `SELECT
       cs.class_section_id,
       cs.course_id,
       cs.semester_id,
       cs.classroom_id,
       cs.section_number,
       cs.meeting_start_time,
       cs.meeting_end_time,
       cs.modality,
       cs.capacity,
       cs.enrolled_count,
       cs.section_status,
       c.subject_code,
       c.course_number,
       c.course_title,
       c.course_units,
       b.building_id,
       b.building_name,
       b.map_element_id,
       cr.room_number,
       ARRAY(
         SELECT md.day_of_week
         FROM public.meeting_day md
         WHERE md.class_section_id = cs.class_section_id
       ) AS meeting_days
     FROM public.class_section cs
     JOIN public.course c
       ON c.course_id = cs.course_id
     LEFT JOIN public.classroom cr
       ON cr.classroom_id = cs.classroom_id
     LEFT JOIN public.building b
       ON b.building_id = cr.building_id
     WHERE cs.class_section_id = $1`,
    [classSectionId]
  );

  return result.rows[0] || null;
}

async function getExistingStudentSections(client, studentId, semesterId) {
  const result = await client.query(
    `SELECT
       cs.class_section_id,
       cs.course_id,
       cs.semester_id,
       cs.section_number,
       cs.meeting_start_time,
       cs.meeting_end_time,
       c.subject_code,
       c.course_number,
       c.course_title,
       b.building_id,
       b.building_name,
       b.map_element_id,
       cr.room_number,
       ARRAY(
         SELECT md.day_of_week
         FROM public.meeting_day md
         WHERE md.class_section_id = cs.class_section_id
       ) AS meeting_days,
       source
     FROM (
       SELECT e.class_section_id, 'enrolled' AS source
       FROM public.enrollment e
       JOIN public.class_section ecs
         ON ecs.class_section_id = e.class_section_id
       WHERE e.student_id = $1
         AND ecs.semester_id = $2
         AND e.enrollment_status IN ('enrolled', 'completed')
       UNION
       SELECT cc.class_section_id, 'cart' AS source
       FROM public.class_cart cc
       JOIN public.class_section ccs
         ON ccs.class_section_id = cc.class_section_id
       WHERE cc.student_id = $1
         AND ccs.semester_id = $2
     ) selected
     JOIN public.class_section cs
       ON cs.class_section_id = selected.class_section_id
     JOIN public.course c
       ON c.course_id = cs.course_id
     LEFT JOIN public.classroom cr
       ON cr.classroom_id = cs.classroom_id
     LEFT JOIN public.building b
       ON b.building_id = cr.building_id`,
    [studentId, semesterId]
  );

  return result.rows;
}

async function validateCartSection(client, studentId, section) {
  const errors = [];
  const warnings = [];

  const semesterResult = await client.query(
    `SELECT is_active FROM public.semester WHERE semester_id = $1`,
    [section.semester_id]
  );
  if (!semesterResult.rows[0]?.is_active) {
    errors.push({
      code: "SEMESTER_NOT_ACTIVE",
      message: "This semester is view-only because it is not the active semester.",
    });
  }

  if (section.section_status === "cancelled") {
    errors.push({
      code: "SECTION_CANCELLED",
      message: "This class section is cancelled.",
    });
  }

  if (section.capacity <= section.enrolled_count) {
    errors.push({
      code: "NO_AVAILABLE_SEATS",
      message: "This class section has no available seats.",
    });
  }

  const [
    duplicateResult,
    enrollmentDuplicateResult,
    prerequisiteResult,
    completedResult,
    holdResult,
    studentResult,
    distanceResult,
    cartLoadResult,
  ] = await Promise.all([
    client.query(
      `SELECT 1
       FROM public.class_cart
       WHERE student_id = $1
         AND class_section_id = $2`,
      [studentId, section.class_section_id]
    ),
    client.query(
      `SELECT 1
       FROM public.enrollment
       WHERE student_id = $1
         AND class_section_id = $2
         AND enrollment_status IN ('enrolled', 'completed')`,
      [studentId, section.class_section_id]
    ),
    client.query(
      `SELECT
         cp.prerequisite_course_id,
         cp.minimum_grade,
         c.subject_code,
         c.course_number,
         c.course_title
       FROM public.course_prerequisite cp
       JOIN public.course c
         ON c.course_id = cp.prerequisite_course_id
       WHERE cp.course_id = $1`,
      [section.course_id]
    ),
    client.query(
      `SELECT
         c.course_id,
         e.grade
       FROM public.enrollment e
       JOIN public.class_section cs
         ON cs.class_section_id = e.class_section_id
       JOIN public.course c
         ON c.course_id = cs.course_id
       WHERE e.student_id = $1
         AND e.enrollment_status = 'completed'`,
      [studentId]
    ),
    client.query(
      `SELECT hold_id, hold_type
       FROM public.student_hold
       WHERE student_id = $1
         AND enrollment_block = TRUE
         AND hold_status <> 'resolved'`,
      [studentId]
    ),
    client.query(
      `SELECT student_type, academic_level, walking_speed_mps
       FROM public.student
       WHERE student_id = $1
       FOR UPDATE`,
      [studentId]
    ),
    client.query(
      `SELECT origin_building_id, destination_building_id, distance_meters
       FROM public.building_distance`
    ),
    client.query(
      `SELECT COUNT(*) AS course_count,
         COALESCE(SUM(c.course_units), 0) AS total_units
       FROM public.class_cart cc
       JOIN public.class_section cs ON cs.class_section_id = cc.class_section_id
       JOIN public.course c ON c.course_id = cs.course_id
       WHERE cc.student_id = $1
         AND cs.semester_id = $2`,
      [studentId, section.semester_id]
    ),
  ]);

  if (duplicateResult.rows.length) {
    errors.push({
      code: "ALREADY_IN_CART",
      message: "This class section is already in the cart.",
    });
  }

  if (enrollmentDuplicateResult.rows.length) {
    errors.push({
      code: "ALREADY_ENROLLED",
      message: "The student is already enrolled in this class section.",
    });
  }

  const cartLoad = cartLoadResult.rows[0] || {};
  errors.push(
    ...cartLoadErrors(
      cartLoad.course_count || 0,
      cartLoad.total_units || 0,
      section.course_units || 0
    )
  );

  for (const hold of holdResult.rows) {
    errors.push({
      code: "ENROLLMENT_HOLD",
      message: "Student has an active enrollment-blocking hold.",
      holdId: hold.hold_id,
      holdType: hold.hold_type,
    });
  }

  const completedCourses = new Map();
  for (const row of completedResult.rows) {
    const existing = completedCourses.get(row.course_id);
    const existingRank = GRADE_RANK[String(existing || "").toUpperCase()] ?? -1;
    const nextRank = GRADE_RANK[String(row.grade || "").toUpperCase()] ?? -1;
    if (!existing || nextRank > existingRank) completedCourses.set(row.course_id, row.grade);
  }

  if (meetsMinimumGrade(completedCourses.get(section.course_id), null)) {
    errors.push({
      code: "COURSE_ALREADY_COMPLETED",
      message: "This course has already been passed and cannot earn degree credit again.",
    });
  }

  for (const prerequisite of prerequisiteResult.rows) {
    const completedGrade = completedCourses.get(
      prerequisite.prerequisite_course_id
    );

    if (
      !completedGrade ||
      !meetsMinimumGrade(completedGrade, prerequisite.minimum_grade)
    ) {
      errors.push({
        code: "PREREQUISITE_NOT_MET",
        message: "Course prerequisite has not been completed.",
        prerequisite: {
          courseId: prerequisite.prerequisite_course_id,
          subjectCode: prerequisite.subject_code,
          courseNumber: prerequisite.course_number,
          title: prerequisite.course_title,
          minimumGrade: prerequisite.minimum_grade,
        },
      });
    }
  }

  const student = studentResult.rows[0];
  if (student?.student_type && student?.academic_level) {
    const windowResult = await client.query(
      `SELECT 1
       FROM public.enrollment_window
       WHERE semester_id = $1
         AND student_type = $2
         AND academic_level = $3
         AND CURRENT_TIMESTAMP BETWEEN enrollment_start AND enrollment_end`,
      [section.semester_id, student.student_type, student.academic_level]
    );

    if (!windowResult.rows.length) {
      warnings.push({
        code: "ENROLLMENT_WINDOW_NOT_OPEN",
        message: "No open enrollment window is configured for this student and semester.",
      });
    }
  } else {
    warnings.push({
      code: "ENROLLMENT_WINDOW_NOT_CHECKED",
      message: "Student type or academic level is missing, so enrollment window could not be checked.",
    });
  }

  const existingSections = await getExistingStudentSections(
    client,
    studentId,
    section.semester_id
  );

  for (const existing of existingSections) {
    if (existing.class_section_id === section.class_section_id) {
      continue;
    }

    const sharedDays = (existing.meeting_days || []).filter((day) =>
      (section.meeting_days || []).includes(day)
    );

    const overlaps =
      sharedDays.length &&
      existing.meeting_start_time < section.meeting_end_time &&
      existing.meeting_end_time > section.meeting_start_time;

    if (overlaps) {
      warnings.push({
        code: "SCHEDULE_CONFLICT",
        message: "This class section overlaps with another selected or enrolled section.",
        conflict: sectionSummary(existing),
      });
    }
  }

  const distances = new Map();
  for (const row of distanceResult.rows) {
    distances.set(
      `${row.origin_building_id}:${row.destination_building_id}`,
      Number(row.distance_meters)
    );
    distances.set(
      `${row.destination_building_id}:${row.origin_building_id}`,
      Number(row.distance_meters)
    );
  }

  const walkingSpeedMps = Number(student?.walking_speed_mps) || 1.4;
  for (const existing of existingSections) {
    if (existing.class_section_id === section.class_section_id) {
      continue;
    }

    const sharedDays = (existing.meeting_days || []).filter((day) =>
      (section.meeting_days || []).includes(day)
    );

    if (
      !sharedDays.length ||
      !existing.building_id ||
      !section.building_id ||
      existing.building_id === section.building_id
    ) {
      continue;
    }

    const pairDistance = distances.get(
      `${existing.building_id}:${section.building_id}`
    );

    if (pairDistance === undefined) {
      warnings.push({
        code: "WALKING_DISTANCE_UNKNOWN",
        message: "Walking distance between these buildings is not configured.",
        conflict: sectionSummary(existing),
      });
      continue;
    }

    const gapAfterExisting = minutesBetween(
      existing.meeting_end_time,
      section.meeting_start_time
    );
    const gapBeforeExisting = minutesBetween(
      section.meeting_end_time,
      existing.meeting_start_time
    );
    const availableGap = Math.max(gapAfterExisting, gapBeforeExisting);
    const estimatedWalkingMinutes = Math.ceil(
      pairDistance / walkingSpeedMps / 60
    );

    if (availableGap >= 0 && estimatedWalkingMinutes > availableGap) {
      warnings.push({
        code: "WALKING_TIME_CONFLICT",
        message: "Estimated walking time is longer than the gap between classes.",
        conflict: sectionSummary(existing),
        distanceMeters: pairDistance,
        estimatedWalkingMinutes,
        gapMinutes: availableGap,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function listClassCart(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
        cc.added_date,
        c.course_id,
        c.subject_code,
        c.course_number,
        c.course_title,
        c.course_units,
        cs.class_section_id,
        cs.semester_id,
        cs.section_number,
        cs.modality,
        cs.meeting_type,
        cs.section_status,
        cs.capacity,
        cs.enrolled_count,
        cs.meeting_start_time,
        cs.meeting_end_time,
        i.first_name AS instructor_first_name,
        i.last_name AS instructor_last_name,
        b.building_id,
        b.building_name,
        b.map_element_id,
        cr.room_number,
        ARRAY(
          SELECT md.day_of_week
          FROM public.meeting_day md
          WHERE md.class_section_id = cs.class_section_id
          ORDER BY
            CASE md.day_of_week
              WHEN 'Monday' THEN 1
              WHEN 'Tuesday' THEN 2
              WHEN 'Wednesday' THEN 3
              WHEN 'Thursday' THEN 4
              WHEN 'Friday' THEN 5
              WHEN 'Saturday' THEN 6
              WHEN 'Sunday' THEN 7
            END
        ) AS meeting_days
      FROM public.class_cart cc
      JOIN public.class_section cs
        ON cs.class_section_id = cc.class_section_id
      JOIN public.course c
        ON c.course_id = cs.course_id
      JOIN public.instructor i
        ON i.instructor_id = cs.instructor_id
      LEFT JOIN public.classroom cr
        ON cr.classroom_id = cs.classroom_id
      LEFT JOIN public.building b
        ON b.building_id = cr.building_id
      WHERE cc.student_id = $1
      ORDER BY
        c.subject_code,
        c.course_number,
        cs.section_number`,
      [req.auth.userId]
    );

    return res.json({
      classCart: result.rows.map(cartSectionRow),
    });
  } catch (error) {
    console.error("Unable to load class cart:", error.message);

    return res.status(500).json({
      message: "Unable to load class cart.",
    });
  }
}

async function addClassCartSection(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const classSectionId = cleanId(req.body.classSectionId);
  if (!classSectionId) {
    return res.status(400).json({
      message: "A valid classSectionId is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const section = await getSection(client, classSectionId);
    if (!section) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Class section not found.",
      });
    }

    const validation = await validateCartSection(
      client,
      req.auth.userId,
      section
    );

    if (!validation.valid) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Class section cannot be added to the cart.",
        validation,
      });
    }

    const created = await client.query(
      `INSERT INTO public.class_cart
       (student_id, class_section_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id, class_section_id)
       DO NOTHING
       RETURNING student_id, class_section_id, added_date`,
      [req.auth.userId, classSectionId]
    );

    await client.query("COMMIT");

    return res.status(created.rows.length ? 201 : 200).json({
      message: created.rows.length
        ? "Class section added to class cart."
        : "Class section is already in the class cart.",
      validation,
      classCartItem: {
        studentId: req.auth.userId,
        classSectionId,
        addedDate: created.rows[0]?.added_date || null,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Unable to add class cart section:", error.message);

    return res.status(500).json({
      message: "Unable to add class section to class cart.",
    });
  } finally {
    client.release();
  }
}

async function removeClassCartSection(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const classSectionId = cleanId(req.params.classSectionId);
  if (!classSectionId) {
    return res.status(400).json({
      message: "A valid classSectionId is required.",
    });
  }

  try {
    const cartItem = await pool.query(
      `SELECT s.is_active
       FROM public.class_cart cc
       JOIN public.class_section cs ON cs.class_section_id = cc.class_section_id
       JOIN public.semester s ON s.semester_id = cs.semester_id
       WHERE cc.student_id = $1 AND cc.class_section_id = $2`,
      [req.auth.userId, classSectionId]
    );
    if (!cartItem.rows.length) {
      return res.status(404).json({ message: "Class section was not in the class cart." });
    }
    if (!cartItem.rows[0].is_active) {
      return res.status(409).json({
        message: "This semester is view-only because it is not the active semester.",
        code: "SEMESTER_NOT_ACTIVE",
      });
    }
    const deleted = await pool.query(
      `DELETE FROM public.class_cart
       WHERE student_id = $1
         AND class_section_id = $2
       RETURNING student_id`,
      [req.auth.userId, classSectionId]
    );

    return res.status(204).send();
  } catch (error) {
    console.error("Unable to remove class cart section:", error.message);

    return res.status(500).json({
      message: "Unable to remove class section from class cart.",
    });
  }
}

module.exports = {
  listClassCart,
  addClassCartSection,
  removeClassCartSection,
  cartLoadErrors,
};
