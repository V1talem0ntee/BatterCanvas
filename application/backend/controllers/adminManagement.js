const { pool } = require("../db");

// Shared input helpers keep validation consistent across admin resources.
function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanBoolean(value) {
  // Boolean("false") is true, so form strings must be parsed explicitly.
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function cleanCoordinate(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function buildUpdate(fields, body) {
  // PATCH updates include only submitted allowlisted fields. Values remain SQL
  // parameters; clients never control database column names.
  const values = [];
  const assignments = [];

  for (const [inputField, columnName] of Object.entries(fields)) {
    if (body[inputField] !== undefined) {
      values.push(body[inputField]);
      assignments.push(`${columnName} = $${values.length}`);
    }
  }

  return { assignments, values };
}

function handleAdminError(res, error, message) {
  // Translate common PostgreSQL constraints into safe client-facing responses.
  if (error.code === "23503") {
    return res.status(409).json({
      message: "This record is still referenced by other data.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      message: "A record with the same unique values already exists.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      message: "One or more values do not match the allowed database rules.",
    });
  }

  console.error(message, error.message);
  return res.status(500).json({ message });
}

// Department and major management ------------------------------------------
async function createDepartment(req, res) {
  const schoolId = cleanId(req.body.schoolId);
  const buildingId = cleanId(req.body.buildingId);
  const name = cleanText(req.body.name);
  const officeEmail = cleanText(req.body.officeEmail);
  const officePhone = cleanText(req.body.officePhone);

  if (!schoolId || !buildingId || !name || !officeEmail || !officePhone) {
    return res.status(400).json({
      message:
        "schoolId, buildingId, name, officeEmail, and officePhone are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.department
       (school_id, building_id, department_name, office_email, office_phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING department_id`,
      [schoolId, buildingId, name, officeEmail, officePhone],
    );

    return res.status(201).json({
      departmentId: result.rows[0].department_id,
    });
  } catch (error) {
    return handleAdminError(res, error, "Unable to create department.");
  }
}

async function updateDepartment(req, res) {
  const departmentId = cleanId(req.params.departmentId);

  if (!departmentId) {
    return res.status(400).json({
      message: "A valid departmentId is required.",
    });
  }

  const { assignments, values } = buildUpdate(
    {
      schoolId: "school_id",
      buildingId: "building_id",
      name: "department_name",
      officeEmail: "office_email",
      officePhone: "office_phone",
    },
    req.body,
  );

  if (!assignments.length) {
    return res.status(400).json({
      message: "At least one department field is required.",
    });
  }

  values.push(departmentId);

  try {
    const result = await pool.query(
      `UPDATE public.department
       SET ${assignments.join(", ")}
       WHERE department_id = $${values.length}
       RETURNING department_id`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    return res.json({ departmentId });
  } catch (error) {
    return handleAdminError(res, error, "Unable to update department.");
  }
}

async function deleteDepartment(req, res) {
  const departmentId = cleanId(req.params.departmentId);

  if (!departmentId) {
    return res.status(400).json({
      message: "A valid departmentId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.department
       WHERE department_id = $1
       RETURNING department_id`,
      [departmentId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete department.");
  }
}

async function createMajor(req, res) {
  const departmentId = cleanId(req.body.departmentId);
  const name = cleanText(req.body.name);

  if (!departmentId || !name) {
    return res.status(400).json({
      message: "departmentId and name are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.major
       (department_id, major_name)
       VALUES ($1, $2)
       RETURNING major_id`,
      [departmentId, name],
    );

    return res.status(201).json({
      majorId: result.rows[0].major_id,
    });
  } catch (error) {
    return handleAdminError(res, error, "Unable to create major.");
  }
}

async function updateMajor(req, res) {
  const majorId = cleanId(req.params.majorId);

  if (!majorId) {
    return res.status(400).json({
      message: "A valid majorId is required.",
    });
  }

  const { assignments, values } = buildUpdate(
    {
      departmentId: "department_id",
      name: "major_name",
    },
    req.body,
  );

  if (!assignments.length) {
    return res.status(400).json({
      message: "At least one major field is required.",
    });
  }

  values.push(majorId);

  try {
    const result = await pool.query(
      `UPDATE public.major
       SET ${assignments.join(", ")}
       WHERE major_id = $${values.length}
       RETURNING major_id`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Major not found.",
      });
    }

    return res.json({ majorId });
  } catch (error) {
    return handleAdminError(res, error, "Unable to update major.");
  }
}

async function deleteMajor(req, res) {
  const majorId = cleanId(req.params.majorId);

  if (!majorId) {
    return res.status(400).json({
      message: "A valid majorId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.major
       WHERE major_id = $1
       RETURNING major_id`,
      [majorId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Major not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete major.");
  }
}

// Course management ---------------------------------------------------------
async function syncCourseGeArea(client, courseId, category, geAreaId) {
  await client.query(
    `DELETE FROM public.course_ge_area
     WHERE course_id = $1`,
    [courseId],
  );

  if (category === "ge") {
    await client.query(
      `INSERT INTO public.course_ge_area
       (course_id, ge_area_id)
       VALUES ($1, $2)`,
      [courseId, geAreaId],
    );
  }
}

async function createCourse(req, res) {
  const departmentId = cleanId(req.body.departmentId);
  const subjectCode = cleanText(req.body.subjectCode);
  const courseNumber = cleanText(req.body.courseNumber);
  const title = cleanText(req.body.title);
  const description = cleanText(req.body.description);
  const units = Number(req.body.units);
  const level = cleanText(req.body.level);
  const repeatable = cleanBoolean(req.body.repeatable);
  const sectionType = cleanText(req.body.sectionType);
  const category = cleanText(req.body.category);
  const geAreaId = req.body.geAreaId ? cleanId(req.body.geAreaId) : null;

  if (
    !departmentId ||
    !subjectCode ||
    !courseNumber ||
    !title ||
    !description ||
    !Number.isInteger(units) ||
    units <= 0 ||
    !level ||
    !sectionType ||
    repeatable === null ||
    !["major-core", "major-elective", "ge"].includes(category) ||
    (category === "ge" && !geAreaId)
  ) {
    return res.status(400).json({
      message:
        "departmentId, course details, level, repeatable, sectionType, category, and GE area when applicable are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO public.course
       (department_id, subject_code, course_number, course_title, course_description,
        course_units, course_level, repeatable, section_type, course_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING course_id`,
      [
        departmentId,
        subjectCode,
        courseNumber,
        title,
        description,
        units,
        level,
        repeatable,
        sectionType,
        category,
      ],
    );

    const courseId = result.rows[0].course_id;

    await syncCourseGeArea(client, courseId, category, geAreaId);
    await client.query("COMMIT");

    return res.status(201).json({ courseId });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to create course.");
  } finally {
    client.release();
  }
}

async function bulkImportCourses(req, res) {
  const courses = req.body.courses;

  if (!Array.isArray(courses) || !courses.length || courses.length > 500) {
    return res.status(400).json({
      message: "courses must contain between 1 and 500 rows.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const departments = await client.query(
      `SELECT department_id, department_name
       FROM public.department`,
    );

    const geAreas = await client.query(
      `SELECT ge_area_id, ge_area_code
       FROM public.ge_area`,
    );

    const departmentByName = new Map(
      departments.rows.map((row) => [
        row.department_name.toLowerCase(),
        row.department_id,
      ]),
    );

    const geAreaByCode = new Map(
      geAreas.rows.map((row) => [
        row.ge_area_code.toLowerCase(),
        row.ge_area_id,
      ]),
    );

    for (let index = 0; index < courses.length; index += 1) {
      const row = courses[index] || {};
      const rowNumber = index + 2;
      const departmentId =
        cleanId(row.departmentId) ||
        departmentByName.get(cleanText(row.department).toLowerCase());
      const subjectCode = cleanText(row.subjectCode).toUpperCase();
      const courseNumber = cleanText(row.courseNumber);
      const title = cleanText(row.title);
      const description = cleanText(row.description);
      const units = Number(row.units);
      const level = cleanText(row.level).toLowerCase();
      const category = cleanText(row.category).toLowerCase();
      const sectionType = cleanText(row.sectionType).toLowerCase();
      const repeatable = cleanBoolean(row.repeatable);
      const geAreaId =
        category === "ge"
          ? geAreaByCode.get(
              cleanText(row.geArea)
                .replace(/^area\s+/i, "")
                .toLowerCase(),
            )
          : null;

      if (
        !departmentId ||
        !subjectCode ||
        !courseNumber ||
        !title ||
        !description ||
        !Number.isInteger(units) ||
        units <= 0 ||
        !["lower_division", "upper_division", "graduate"].includes(level) ||
        !["major-core", "major-elective", "ge"].includes(category) ||
        !["lecture", "lab"].includes(sectionType) ||
        repeatable === null ||
        (category === "ge" && !geAreaId)
      ) {
        const error = new Error(
          `CSV row ${rowNumber} contains missing or invalid course data.`,
        );

        error.statusCode = 400;
        throw error;
      }

      const result = await client.query(
        `INSERT INTO public.course
         (department_id, subject_code, course_number, course_title, course_description,
          course_units, course_level, repeatable, section_type, course_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (department_id, subject_code, course_number)
         DO UPDATE SET
          course_title = EXCLUDED.course_title,
          course_description = EXCLUDED.course_description,
          course_units = EXCLUDED.course_units,
          course_level = EXCLUDED.course_level,
          repeatable = EXCLUDED.repeatable,
          section_type = EXCLUDED.section_type,
          course_category = EXCLUDED.course_category
         RETURNING course_id`,
        [
          departmentId,
          subjectCode,
          courseNumber,
          title,
          description,
          units,
          level,
          repeatable,
          sectionType,
          category,
        ],
      );

      await syncCourseGeArea(
        client,
        result.rows[0].course_id,
        category,
        geAreaId,
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      imported: courses.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    return handleAdminError(res, error, "Unable to import courses.");
  } finally {
    client.release();
  }
}

async function updateCourse(req, res) {
  const courseId = cleanId(req.params.courseId);

  if (!courseId) {
    return res.status(400).json({
      message: "A valid courseId is required.",
    });
  }

  if (req.body.repeatable !== undefined) {
    const repeatable = cleanBoolean(req.body.repeatable);

    if (repeatable === null) {
      return res.status(400).json({
        message: "repeatable must be a boolean.",
      });
    }

    req.body.repeatable = repeatable;
  }

  if (
    req.body.units !== undefined &&
    (!Number.isInteger(Number(req.body.units)) || Number(req.body.units) <= 0)
  ) {
    return res.status(400).json({
      message: "units must be a positive integer.",
    });
  }

  const category =
    req.body.category === undefined ? null : cleanText(req.body.category);
  const geAreaId = req.body.geAreaId ? cleanId(req.body.geAreaId) : null;

  if (category && !["major-core", "major-elective", "ge"].includes(category)) {
    return res.status(400).json({
      message: "category must be major-core, major-elective, or ge.",
    });
  }

  if (category === "ge" && !geAreaId) {
    return res.status(400).json({
      message: "A GE area is required for a GE course.",
    });
  }

  const { assignments, values } = buildUpdate(
    {
      departmentId: "department_id",
      subjectCode: "subject_code",
      courseNumber: "course_number",
      title: "course_title",
      description: "course_description",
      units: "course_units",
      level: "course_level",
      repeatable: "repeatable",
      sectionType: "section_type",
      category: "course_category",
    },
    req.body,
  );

  if (!assignments.length && !category) {
    return res.status(400).json({
      message: "At least one course field is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (assignments.length) {
      values.push(courseId);

      const result = await client.query(
        `UPDATE public.course
         SET ${assignments.join(", ")}
         WHERE course_id = $${values.length}
         RETURNING course_id`,
        values,
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Course not found.",
        });
      }
    }

    if (category) {
      await syncCourseGeArea(client, courseId, category, geAreaId);
    }

    await client.query("COMMIT");

    return res.json({ courseId });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to update course.");
  } finally {
    client.release();
  }
}

async function deleteCourse(req, res) {
  const courseId = cleanId(req.params.courseId);

  if (!courseId) {
    return res.status(400).json({
      message: "A valid courseId is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const courseResult = await client.query(
      `SELECT
         c.course_id,
         EXISTS (
           SELECT 1
           FROM public.class_section cs
           WHERE cs.course_id = c.course_id
         ) AS has_sections
       FROM public.course c
       WHERE c.course_id = $1
       FOR UPDATE`,
      [courseId],
    );

    if (!courseResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    if (courseResult.rows[0].has_sections) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message:
          "Delete this course's class sections before deleting the course.",
      });
    }

    await client.query(
      `DELETE FROM public.student_plan_item
       WHERE selected_course_id = $1
          OR roadmap_item_id IN (
            SELECT roadmap_item_id
            FROM public.degree_roadmap_item
            WHERE course_id = $1
          )`,
      [courseId],
    );

    await client.query(
      `DELETE FROM public.degree_roadmap_item
       WHERE course_id = $1`,
      [courseId],
    );

    await client.query(
      `DELETE FROM public.planned_course
       WHERE course_id = $1`,
      [courseId],
    );

    await client.query(
      `DELETE FROM public.required_course
       WHERE course_id = $1`,
      [courseId],
    );

    await client.query(
      `DELETE FROM public.course_prerequisite
       WHERE course_id = $1
          OR prerequisite_course_id = $1`,
      [courseId],
    );

    await client.query(
      `DELETE FROM public.course_ge_area
       WHERE course_id = $1`,
      [courseId],
    );

    await client.query(
      `DELETE FROM public.course
       WHERE course_id = $1`,
      [courseId],
    );

    await client.query("COMMIT");

    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to delete course.");
  } finally {
    client.release();
  }
}

// Class-section management -------------------------------------------------
async function createSection(req, res) {
  const courseId = cleanId(req.params.courseId);
  const semesterId = cleanId(req.body.semesterId);
  const classroomId = req.body.classroomId
    ? cleanId(req.body.classroomId)
    : null;
  const instructorId = cleanId(req.body.instructorId);
  const sectionNumber = cleanText(req.body.sectionNumber);
  const meetingStartTime = cleanText(req.body.meetingStartTime);
  const meetingEndTime = cleanText(req.body.meetingEndTime);
  const modality = cleanText(req.body.modality);
  const meetingType = cleanText(req.body.meetingType);
  const capacity = Number(req.body.capacity);
  const enrolledCount = Number(req.body.enrolledCount || 0);
  const waitlistCapacity = Number(req.body.waitlistCapacity || 0);
  const waitlistCount = Number(req.body.waitlistCount || 0);
  const status = cleanText(req.body.status);
  const meetingDays = Array.isArray(req.body.meetingDays)
    ? req.body.meetingDays
    : [];

  if (
    !courseId ||
    !semesterId ||
    !instructorId ||
    !sectionNumber ||
    !meetingStartTime ||
    !meetingEndTime ||
    !modality ||
    !meetingType ||
    !Number.isInteger(capacity) ||
    capacity < 0 ||
    !Number.isInteger(enrolledCount) ||
    enrolledCount < 0 ||
    enrolledCount > capacity ||
    !Number.isInteger(waitlistCapacity) ||
    waitlistCapacity < 0 ||
    !Number.isInteger(waitlistCount) ||
    waitlistCount < 0 ||
    waitlistCount > waitlistCapacity ||
    !status
  ) {
    return res.status(400).json({
      message:
        "courseId, semesterId, instructorId, sectionNumber, times, modality, meetingType, capacity, and status are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const semesterResult = await client.query(
      `SELECT start_date, end_date
       FROM public.semester
       WHERE semester_id = $1`,
      [semesterId],
    );

    if (!semesterResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Semester not found.",
      });
    }

    const { start_date: startDate, end_date: endDate } = semesterResult.rows[0];

    const result = await client.query(
      `INSERT INTO public.class_section
       (course_id, semester_id, classroom_id, instructor_id, section_number,
        start_date, end_date, meeting_start_time, meeting_end_time, modality,
        meeting_type, capacity, enrolled_count, waitlist_capacity, waitlist_count,
        section_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING class_section_id`,
      [
        courseId,
        semesterId,
        classroomId,
        instructorId,
        sectionNumber,
        startDate,
        endDate,
        meetingStartTime,
        meetingEndTime,
        modality,
        meetingType,
        capacity,
        enrolledCount,
        waitlistCapacity,
        waitlistCount,
        status,
      ],
    );

    const classSectionId = result.rows[0].class_section_id;

    for (const dayOfWeek of meetingDays) {
      await client.query(
        `INSERT INTO public.meeting_day
         (class_section_id, day_of_week)
         VALUES ($1, $2)`,
        [classSectionId, dayOfWeek],
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({ classSectionId });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to create class section.");
  } finally {
    client.release();
  }
}

async function updateSection(req, res) {
  const classSectionId = cleanId(req.params.classSectionId);

  if (!classSectionId) {
    return res.status(400).json({
      message: "A valid classSectionId is required.",
    });
  }

  const requestedSemesterId =
    req.body.semesterId === undefined ? null : cleanId(req.body.semesterId);

  if (req.body.semesterId !== undefined && !requestedSemesterId) {
    return res.status(400).json({
      message: "semesterId must be a positive integer.",
    });
  }

  const { assignments, values } = buildUpdate(
    {
      courseId: "course_id",
      classroomId: "classroom_id",
      instructorId: "instructor_id",
      sectionNumber: "section_number",
      meetingStartTime: "meeting_start_time",
      meetingEndTime: "meeting_end_time",
      modality: "modality",
      meetingType: "meeting_type",
      capacity: "capacity",
      enrolledCount: "enrolled_count",
      waitlistCapacity: "waitlist_capacity",
      waitlistCount: "waitlist_count",
      status: "section_status",
    },
    req.body,
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (requestedSemesterId) {
      const semesterResult = await client.query(
        `SELECT start_date, end_date
         FROM public.semester
         WHERE semester_id = $1`,
        [requestedSemesterId],
      );

      if (!semesterResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Semester not found.",
        });
      }

      values.push(requestedSemesterId);
      assignments.push(`semester_id = $${values.length}`);

      values.push(semesterResult.rows[0].start_date);
      assignments.push(`start_date = $${values.length}`);

      values.push(semesterResult.rows[0].end_date);
      assignments.push(`end_date = $${values.length}`);
    }

    if (assignments.length) {
      values.push(classSectionId);

      const result = await client.query(
        `UPDATE public.class_section
         SET ${assignments.join(", ")}
         WHERE class_section_id = $${values.length}
         RETURNING class_section_id`,
        values,
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Class section not found.",
        });
      }
    }

    if (Array.isArray(req.body.meetingDays)) {
      await client.query(
        `DELETE FROM public.meeting_day
         WHERE class_section_id = $1`,
        [classSectionId],
      );

      for (const dayOfWeek of req.body.meetingDays) {
        await client.query(
          `INSERT INTO public.meeting_day
           (class_section_id, day_of_week)
           VALUES ($1, $2)`,
          [classSectionId, dayOfWeek],
        );
      }
    }

    await client.query("COMMIT");

    return res.json({ classSectionId });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to update class section.");
  } finally {
    client.release();
  }
}

async function deleteSection(req, res) {
  const classSectionId = cleanId(req.params.classSectionId);

  if (!classSectionId) {
    return res.status(400).json({
      message: "A valid classSectionId is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM public.meeting_day
       WHERE class_section_id = $1`,
      [classSectionId],
    );

    const result = await client.query(
      `DELETE FROM public.class_section
       WHERE class_section_id = $1
       RETURNING class_section_id`,
      [classSectionId],
    );

    await client.query("COMMIT");

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Class section not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to delete class section.");
  } finally {
    client.release();
  }
}

// Degree programs contain catalog-year graduation requirements.
async function createDegreeProgram(req, res) {
  const majorId = cleanId(req.body.majorId);
  const degreeType = cleanText(req.body.degreeType);
  const catalogYear = Number(req.body.catalogYear);
  const requiredMajorUnits = Number(req.body.requiredMajorUnits);
  const requiredGeUnits = Number(req.body.requiredGeUnits);

  if (
    !majorId ||
    !degreeType ||
    !Number.isInteger(catalogYear) ||
    !Number.isInteger(requiredMajorUnits) ||
    requiredMajorUnits < 0 ||
    !Number.isInteger(requiredGeUnits) ||
    requiredGeUnits < 0
  ) {
    return res.status(400).json({
      message:
        "majorId, degreeType, catalogYear, requiredMajorUnits, and requiredGeUnits are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.degree_program
       (major_id, degree_type, catalog_year, required_major_units, required_ge_units)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING degree_program_id`,
      [majorId, degreeType, catalogYear, requiredMajorUnits, requiredGeUnits],
    );

    return res.status(201).json({
      degreeProgramId: result.rows[0].degree_program_id,
    });
  } catch (error) {
    return handleAdminError(res, error, "Unable to create degree program.");
  }
}

async function updateDegreeProgram(req, res) {
  const degreeProgramId = cleanId(req.params.degreeProgramId);

  if (!degreeProgramId) {
    return res.status(400).json({
      message: "A valid degreeProgramId is required.",
    });
  }

  for (const field of [
    "catalogYear",
    "requiredMajorUnits",
    "requiredGeUnits",
  ]) {
    if (
      req.body[field] !== undefined &&
      (!Number.isInteger(Number(req.body[field])) ||
        (field !== "catalogYear" && Number(req.body[field]) < 0))
    ) {
      return res.status(400).json({
        message: `${field} must be a valid integer.`,
      });
    }
  }

  const { assignments, values } = buildUpdate(
    {
      majorId: "major_id",
      degreeType: "degree_type",
      catalogYear: "catalog_year",
      requiredMajorUnits: "required_major_units",
      requiredGeUnits: "required_ge_units",
    },
    req.body,
  );

  if (!assignments.length) {
    return res.status(400).json({
      message: "At least one degree program field is required.",
    });
  }

  values.push(degreeProgramId);

  try {
    const result = await pool.query(
      `UPDATE public.degree_program
       SET ${assignments.join(", ")}
       WHERE degree_program_id = $${values.length}
       RETURNING degree_program_id`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Degree program not found.",
      });
    }

    return res.json({ degreeProgramId });
  } catch (error) {
    return handleAdminError(res, error, "Unable to update degree program.");
  }
}

async function deleteDegreeProgram(req, res) {
  const degreeProgramId = cleanId(req.params.degreeProgramId);

  if (!degreeProgramId) {
    return res.status(400).json({
      message: "A valid degreeProgramId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.degree_program
       WHERE degree_program_id = $1
       RETURNING degree_program_id`,
      [degreeProgramId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Degree program not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete degree program.");
  }
}

// Campus building and classroom management ---------------------------------
async function createBuilding(req, res) {
  const schoolId = cleanId(req.body.schoolId);
  const name = cleanText(req.body.name);
  const mapElementId = cleanText(req.body.mapElementId);
  const latitude = cleanCoordinate(req.body.latitude);
  const longitude = cleanCoordinate(req.body.longitude);

  if (!schoolId || !name || !mapElementId) {
    return res.status(400).json({
      message: "schoolId, name, and mapElementId are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.building
       (school_id, building_name, map_element_id, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING building_id`,
      [schoolId, name, mapElementId, latitude, longitude],
    );

    return res.status(201).json({
      buildingId: result.rows[0].building_id,
    });
  } catch (error) {
    return handleAdminError(res, error, "Unable to create building.");
  }
}

async function updateBuilding(req, res) {
  const buildingId = cleanId(req.params.buildingId);

  if (!buildingId) {
    return res.status(400).json({
      message: "A valid buildingId is required.",
    });
  }

  if (req.body.latitude !== undefined) {
    req.body.latitude = cleanCoordinate(req.body.latitude);
  }

  if (req.body.longitude !== undefined) {
    req.body.longitude = cleanCoordinate(req.body.longitude);
  }

  const { assignments, values } = buildUpdate(
    {
      schoolId: "school_id",
      name: "building_name",
      mapElementId: "map_element_id",
      latitude: "latitude",
      longitude: "longitude",
    },
    req.body,
  );

  if (!assignments.length) {
    return res.status(400).json({
      message: "At least one building field is required.",
    });
  }

  values.push(buildingId);

  try {
    const result = await pool.query(
      `UPDATE public.building
       SET ${assignments.join(", ")}
       WHERE building_id = $${values.length}
       RETURNING building_id`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Building not found.",
      });
    }

    return res.json({ buildingId });
  } catch (error) {
    return handleAdminError(res, error, "Unable to update building.");
  }
}

async function deleteBuilding(req, res) {
  const buildingId = cleanId(req.params.buildingId);

  if (!buildingId) {
    return res.status(400).json({
      message: "A valid buildingId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.building
       WHERE building_id = $1
       RETURNING building_id`,
      [buildingId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Building not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete building.");
  }
}

async function generateBuildingDistances(req, res) {
  try {
    const result = await pool.query(
      `INSERT INTO public.building_distance
       (origin_building_id, destination_building_id, distance_meters)
       SELECT
         b1.building_id,
         b2.building_id,
         ROUND(
           (
             SQRT(
               POWER((b2.latitude - b1.latitude) * 111320, 2) +
               POWER(
                 (b2.longitude - b1.longitude) *
                 111320 *
                 COS(RADIANS((b1.latitude + b2.latitude) / 2)),
                 2
               )
             ) * 1.25
           )::numeric,
           2
         ) AS distance_meters
       FROM public.building b1
       JOIN public.building b2
         ON b1.building_id < b2.building_id
       WHERE b1.latitude IS NOT NULL
         AND b1.longitude IS NOT NULL
         AND b2.latitude IS NOT NULL
         AND b2.longitude IS NOT NULL
       ON CONFLICT (origin_building_id, destination_building_id)
       DO UPDATE SET distance_meters = EXCLUDED.distance_meters
       RETURNING origin_building_id`,
    );

    return res.json({
      message: "Building distances generated.",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "Unable to generate building distances.",
    );
  }
}

async function createClassroom(req, res) {
  const buildingId = cleanId(req.body.buildingId);
  const roomNumber = cleanText(req.body.roomNumber);

  if (!buildingId || !roomNumber) {
    return res.status(400).json({
      message: "buildingId and roomNumber are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.classroom
       (building_id, room_number)
       VALUES ($1, $2)
       RETURNING classroom_id`,
      [buildingId, roomNumber],
    );

    return res.status(201).json({
      classroomId: result.rows[0].classroom_id,
    });
  } catch (error) {
    return handleAdminError(res, error, "Unable to create classroom.");
  }
}

async function createClassroomsForFloor(req, res) {
  const buildingId = cleanId(req.params.buildingId);
  const floor = Number(req.body.floor);
  const roomCount = Number(req.body.roomCount);

  if (
    !buildingId ||
    !Number.isInteger(floor) ||
    floor < 1 ||
    floor > 9 ||
    !Number.isInteger(roomCount) ||
    roomCount < 1 ||
    roomCount > 99
  ) {
    return res.status(400).json({
      message:
        "A valid buildingId, floor from 1 to 9, and roomCount from 1 to 99 are required.",
    });
  }

  const roomNumbers = Array.from({ length: roomCount }, (_, index) =>
    String(floor * 100 + index + 1),
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const building = await client.query(
      `SELECT building_id
       FROM public.building
       WHERE building_id = $1
       FOR UPDATE`,
      [buildingId],
    );

    if (!building.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Building not found.",
      });
    }

    const created = await client.query(
      `INSERT INTO public.classroom
       (building_id, room_number)
       SELECT $1, room_number
       FROM UNNEST($2::text[]) AS room_number
       ON CONFLICT (building_id, room_number)
       DO NOTHING
       RETURNING classroom_id, room_number`,
      [buildingId, roomNumbers],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      buildingId,
      floor,
      requestedCount: roomCount,
      createdCount: created.rows.length,
      skippedCount: roomCount - created.rows.length,
      classrooms: created.rows.map((row) => ({
        classroomId: row.classroom_id,
        roomNumber: row.room_number,
      })),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to create classrooms.");
  } finally {
    client.release();
  }
}

async function updateClassroom(req, res) {
  const classroomId = cleanId(req.params.classroomId);

  if (!classroomId) {
    return res.status(400).json({
      message: "A valid classroomId is required.",
    });
  }

  const { assignments, values } = buildUpdate(
    {
      buildingId: "building_id",
      roomNumber: "room_number",
    },
    req.body,
  );

  if (!assignments.length) {
    return res.status(400).json({
      message: "At least one classroom field is required.",
    });
  }

  values.push(classroomId);

  try {
    const result = await pool.query(
      `UPDATE public.classroom
       SET ${assignments.join(", ")}
       WHERE classroom_id = $${values.length}
       RETURNING classroom_id`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Classroom not found.",
      });
    }

    return res.json({ classroomId });
  } catch (error) {
    return handleAdminError(res, error, "Unable to update classroom.");
  }
}

async function deleteClassroom(req, res) {
  const classroomId = cleanId(req.params.classroomId);

  if (!classroomId) {
    return res.status(400).json({
      message: "A valid classroomId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.classroom
       WHERE classroom_id = $1
       RETURNING classroom_id`,
      [classroomId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Classroom not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete classroom.");
  }
}

// Degree-requirement management --------------------------------------------
async function createDegreeRequirement(req, res) {
  const degreeProgramId = cleanId(req.body.degreeProgramId);
  const geAreaId = req.body.geAreaId ? cleanId(req.body.geAreaId) : null;
  const name = cleanText(req.body.name);
  const type = cleanText(req.body.type);
  const completionRule =
    cleanText(req.body.completionRule) ||
    (type === "major-core" ? "all-courses" : "minimum-units");
  const requiredUnits = Number(req.body.requiredUnits);
  const minimumGrade = req.body.minimumGrade
    ? cleanText(req.body.minimumGrade)
    : null;

  if (
    !degreeProgramId ||
    !name ||
    !type ||
    !Number.isInteger(requiredUnits) ||
    !["all-courses", "minimum-units"].includes(completionRule)
  ) {
    return res.status(400).json({
      message: "degreeProgramId, name, type, and requiredUnits are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.degree_requirement
       (degree_program_id, ge_area_id, requirement_name, requirement_type,
        completion_rule, required_units, minimum_grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING degree_requirement_id`,
      [
        degreeProgramId,
        geAreaId,
        name,
        type,
        completionRule,
        requiredUnits,
        minimumGrade,
      ],
    );

    return res.status(201).json({
      degreeRequirementId: result.rows[0].degree_requirement_id,
    });
  } catch (error) {
    return handleAdminError(res, error, "Unable to create degree requirement.");
  }
}

async function updateDegreeRequirement(req, res) {
  const degreeRequirementId = cleanId(req.params.degreeRequirementId);

  if (!degreeRequirementId) {
    return res.status(400).json({
      message: "A valid degreeRequirementId is required.",
    });
  }

  const { assignments, values } = buildUpdate(
    {
      degreeProgramId: "degree_program_id",
      geAreaId: "ge_area_id",
      name: "requirement_name",
      type: "requirement_type",
      completionRule: "completion_rule",
      requiredUnits: "required_units",
      minimumGrade: "minimum_grade",
    },
    req.body,
  );

  if (!assignments.length) {
    return res.status(400).json({
      message: "At least one degree requirement field is required.",
    });
  }

  values.push(degreeRequirementId);

  try {
    const result = await pool.query(
      `UPDATE public.degree_requirement
       SET ${assignments.join(", ")}
       WHERE degree_requirement_id = $${values.length}
       RETURNING degree_requirement_id`,
      values,
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Degree requirement not found.",
      });
    }

    return res.json({ degreeRequirementId });
  } catch (error) {
    return handleAdminError(res, error, "Unable to update degree requirement.");
  }
}

async function deleteDegreeRequirement(req, res) {
  const degreeRequirementId = cleanId(req.params.degreeRequirementId);

  if (!degreeRequirementId) {
    return res.status(400).json({
      message: "A valid degreeRequirementId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.degree_requirement
       WHERE degree_requirement_id = $1
       RETURNING degree_requirement_id`,
      [degreeRequirementId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Degree requirement not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete degree requirement.");
  }
}

// Student transcript management --------------------------------------------
const ALLOWED_GRADES = new Set([
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
  "P",
  "NP",
]);

async function setStudentCourseResult(req, res) {
  const studentId = cleanId(req.params.studentId);
  const classSectionId = cleanId(req.params.classSectionId);
  const grade = cleanText(req.body.grade).toUpperCase();
  const enrollmentDate =
    req.body.enrollmentDate || new Date().toISOString().slice(0, 10);

  if (!studentId || !classSectionId || !ALLOWED_GRADES.has(grade)) {
    return res.status(400).json({
      message: "Valid studentId, classSectionId, and grade are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.enrollment
       (student_id, class_section_id, enrollment_date, enrollment_status, grade)
       VALUES ($1, $2, $3, 'completed', $4)
       ON CONFLICT (student_id, class_section_id)
       DO UPDATE SET
         enrollment_status = 'completed',
         grade = EXCLUDED.grade,
         enrollment_date = EXCLUDED.enrollment_date
       RETURNING student_id, class_section_id, grade`,
      [studentId, classSectionId, enrollmentDate, grade],
    );

    return res.json({
      studentId: result.rows[0].student_id,
      classSectionId: result.rows[0].class_section_id,
      grade: result.rows[0].grade,
      passed: !["F", "NP"].includes(result.rows[0].grade),
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "Unable to save student course result.",
    );
  }
}

async function deleteStudentCourseResult(req, res) {
  const studentId = cleanId(req.params.studentId);
  const classSectionId = cleanId(req.params.classSectionId);

  if (!studentId || !classSectionId) {
    return res.status(400).json({
      message: "Valid studentId and classSectionId are required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.enrollment
       WHERE student_id = $1
         AND class_section_id = $2
       RETURNING student_id`,
      [studentId, classSectionId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Course result not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "Unable to delete student course result.",
    );
  }
}

async function dropStudentFromSection(req, res) {
  const studentId = cleanId(req.params.studentId);
  const classSectionId = cleanId(req.params.classSectionId);

  if (!studentId || !classSectionId) {
    return res.status(400).json({
      message: "Valid studentId and classSectionId are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const enrollmentResult = await client.query(
      `SELECT enrollment_status, grade
       FROM public.enrollment
       WHERE student_id = $1
         AND class_section_id = $2
       FOR UPDATE`,
      [studentId, classSectionId],
    );

    const enrollment = enrollmentResult.rows[0];

    if (enrollment?.enrollment_status === "completed" || enrollment?.grade) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          "A completed course result cannot be dropped. Use course-result management instead.",
      });
    }

    const cartResult = await client.query(
      `DELETE FROM public.class_cart
       WHERE student_id = $1
         AND class_section_id = $2
       RETURNING student_id`,
      [studentId, classSectionId],
    );

    let droppedEnrollment = false;

    if (enrollment?.enrollment_status === "enrolled") {
      await client.query(
        `UPDATE public.enrollment
         SET enrollment_status = 'dropped',
             grade = NULL
         WHERE student_id = $1
           AND class_section_id = $2`,
        [studentId, classSectionId],
      );

      await client.query(
        `UPDATE public.class_section
         SET enrolled_count = GREATEST(enrolled_count - 1, 0)
         WHERE class_section_id = $1`,
        [classSectionId],
      );

      droppedEnrollment = true;
    }

    if (!cartResult.rows.length && !droppedEnrollment) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message:
          "The student is not currently selected or enrolled in this section.",
      });
    }

    await client.query("COMMIT");

    return res.json({
      studentId,
      classSectionId,
      removedFromCart: Boolean(cartResult.rows.length),
      enrollmentStatus: droppedEnrollment ? "dropped" : null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to drop student from section.");
  } finally {
    client.release();
  }
}

async function setActiveSemester(req, res) {
  const semesterId = cleanId(req.params.semesterId);
  const isActive = cleanBoolean(req.body.isActive);

  if (!semesterId || isActive === null) {
    return res.status(400).json({
      message: "A valid semesterId and boolean isActive are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const semesterResult = await client.query(
      `SELECT semester_id, school_id
       FROM public.semester
       WHERE semester_id = $1
       FOR UPDATE`,
      [semesterId],
    );

    const semester = semesterResult.rows[0];

    if (!semester) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Semester not found.",
      });
    }

    if (isActive) {
      await client.query(
        `UPDATE public.semester
         SET is_active = FALSE
         WHERE school_id = $1
           AND semester_id <> $2
           AND is_active = TRUE`,
        [semester.school_id, semesterId],
      );
    }

    await client.query(
      `UPDATE public.semester
       SET is_active = $2
       WHERE semester_id = $1`,
      [semesterId, isActive],
    );

    await client.query("COMMIT");

    return res.json({ semesterId, isActive });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(
      res,
      error,
      "Unable to update the active semester.",
    );
  } finally {
    client.release();
  }
}

async function deleteSemester(req, res) {
  const semesterId = cleanId(req.params.semesterId);

  if (!semesterId) {
    return res.status(400).json({
      message: "A valid semesterId is required.",
    });
  }

  try {
    const semester = await pool.query(
      `SELECT is_active
       FROM public.semester
       WHERE semester_id = $1`,
      [semesterId],
    );

    if (!semester.rows.length) {
      return res.status(404).json({
        message: "Semester not found.",
      });
    }

    if (semester.rows[0].is_active) {
      return res.status(409).json({
        message: "Deactivate the current semester before deleting it.",
      });
    }

    await pool.query(
      `DELETE FROM public.semester
       WHERE semester_id = $1`,
      [semesterId],
    );

    return res.status(204).send();
  } catch (error) {
    return handleAdminError(res, error, "Unable to delete semester.");
  }
}

async function createSemester(req, res) {
  const schoolId = cleanId(req.body.schoolId);
  const year = Number(req.body.year);
  const type = cleanText(req.body.type);
  const startDate = cleanText(req.body.startDate);
  const endDate = cleanText(req.body.endDate);
  const addDropDeadline = cleanText(req.body.addDropDeadline);
  const withdrawalDeadline = cleanText(req.body.withdrawalDeadline);
  const allowedTypes = new Set(["Fall", "Spring", "Summer", "Winter"]);

  if (
    !schoolId ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2200 ||
    !allowedTypes.has(type) ||
    !startDate ||
    !endDate ||
    !addDropDeadline ||
    !withdrawalDeadline
  ) {
    return res.status(400).json({
      message:
        "schoolId, a valid year and term type, and all semester dates are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO public.semester
       (school_id, term_year, term_type, start_date, end_date, add_drop_deadline, withdrawal_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING semester_id`,
      [
        schoolId,
        year,
        type,
        startDate,
        endDate,
        addDropDeadline,
        withdrawalDeadline,
      ],
    );

    await client.query(
      `UPDATE public.student_plan_term
       SET semester_id = $1
       WHERE semester_id IS NULL
         AND term_year = $2
         AND term_type = $3
         AND student_id IN (
           SELECT s.student_id
           FROM public.student s
           JOIN public.degree_program dp
             ON dp.degree_program_id = s.degree_program_id
           JOIN public.major m
             ON m.major_id = dp.major_id
           JOIN public.department d
             ON d.department_id = m.department_id
           WHERE d.school_id = $4
         )`,
      [result.rows[0].semester_id, year, type, schoolId],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      semesterId: result.rows[0].semester_id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminError(res, error, "Unable to create semester.");
  } finally {
    client.release();
  }
}

module.exports = {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createMajor,
  updateMajor,
  deleteMajor,
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
  setStudentCourseResult,
  deleteStudentCourseResult,
  dropStudentFromSection,
  createSemester,
  setActiveSemester,
  deleteSemester,
};
