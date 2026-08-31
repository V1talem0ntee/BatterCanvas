const { pool } = require("../db");

const STUDENT_EDITABLE_FIELDS = {
  phoneNumber: "phone_number",
  street: "street",
  city: "city",
  state: "state",
  zipCode: "zip_code",
  walkingSpeedMps: "walking_speed_mps",
};

const ADMIN_STUDENT_FIELDS = {
  schoolStudentId: "school_student_id",
  degreeProgramId: "degree_program_id",
  expectedGraduationSemesterId: "expected_graduation_semester_id",
  academicLevel: "academic_level",
  studentType: "student_type",
  totalCredits: "total_credits",
};

const ACADEMIC_LEVELS = new Set([
  "freshman",
  "sophomore",
  "junior",
  "senior",
  "graduate",
]);

const STUDENT_TYPES = new Set([
  "first-time",
  "continuing",
  "transfer",
  "international",
]);

function requireStudent(req, res) {
  if (req.auth.role !== "student") {
    res.status(403).json({
      message: "Student access required.",
    });
    return false;
  }

  return true;
}

function studentProfileRow(row) {
  return {
    userId: row.user_id,
    studentId: row.student_id,
    schoolStudentId: row.school_student_id,
    displayId: row.school_student_id,
    email: row.institutional_email,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
    academicLevel: row.academic_level,
    studentType: row.student_type,
    totalCredits: row.total_credits,
    phoneNumber: row.phone_number,
    address: {
      street: row.street,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
    },
    walkingSpeedMps: row.walking_speed_mps,
    degreeProgram: row.degree_program_id
      ? {
          degreeProgramId: row.degree_program_id,
          degreeType: row.degree_type,
          catalogYear: row.catalog_year,
          requiredMajorUnits: row.required_major_units,
          requiredGeUnits: row.required_ge_units,
          major: {
            majorId: row.major_id,
            name: row.major_name,
          },
        }
      : null,
    expectedGraduationTerm: row.expected_graduation_semester_id
      ? {
          semesterId: row.expected_graduation_semester_id,
          year: row.expected_term_year,
          type: row.expected_term_type,
        }
      : null,
  };
}

function cleanOptionalText(value) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  return String(value).trim();
}

function cleanPositiveId(value) {
  if (value === null) {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function cleanNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
}

function cleanWalkingSpeed(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function cleanEmail(value) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  return String(value).trim().toLowerCase();
}

async function loadStudentProfile(studentId) {
  const result = await pool.query(
    `SELECT
        u.user_id,
        u.institutional_email,
        u.first_name,
        u.last_name,
        u.created_at,
        s.student_id,
        s.school_student_id,
        s.degree_program_id,
        s.expected_graduation_semester_id,
        s.academic_level,
        s.student_type,
        s.total_credits,
        s.city,
        s.street,
        s.state,
        s.zip_code,
        s.phone_number,
        s.walking_speed_mps,
        dp.degree_type,
        dp.catalog_year,
        dp.required_major_units,
        dp.required_ge_units,
        m.major_id,
        m.major_name,
        eg.term_year AS expected_term_year,
        eg.term_type AS expected_term_type
      FROM public.app_user u
      JOIN public.student s
        ON s.student_id = u.user_id
      LEFT JOIN public.degree_program dp
        ON dp.degree_program_id = s.degree_program_id
      LEFT JOIN public.major m
        ON m.major_id = dp.major_id
      LEFT JOIN public.semester eg
        ON eg.semester_id = s.expected_graduation_semester_id
      WHERE u.user_id = $1
      LIMIT 1`,
    [studentId]
  );

  return result.rows[0] || null;
}

function addStudentUpdate(updates, values, fieldName, value) {
  values.push(value);
  updates.push(`${fieldName} = $${values.length}`);
}

function dbValue(value) {
  return value === "" || value === undefined ? null : value;
}

function validateStudentEditableBody(body) {
  body = body || {};
  const updates = [];
  const values = [];

  for (const [inputField, dbField] of Object.entries(STUDENT_EDITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, inputField)) {
      continue;
    }

    let value = body[inputField];

    if (inputField === "walkingSpeedMps") {
      value = cleanWalkingSpeed(value);
      if (value === undefined) {
        return {
          error: "walkingSpeedMps must be a positive number.",
        };
      }
    } else {
      value = cleanOptionalText(value);
      if (inputField === "zipCode" && !value) {
        return {
          error: "zipCode cannot be empty.",
        };
      }
    }

    addStudentUpdate(updates, values, dbField, dbValue(value));
  }

  return { updates, values };
}

function validateAdminStudentBody(body) {
  body = body || {};
  const studentUpdates = [];
  const studentValues = [];
  const appUserUpdates = [];
  const appUserValues = [];

  for (const [inputField, dbField] of Object.entries(ADMIN_STUDENT_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, inputField)) {
      continue;
    }

    let value = body[inputField];

    if (
      inputField === "degreeProgramId" ||
      inputField === "expectedGraduationSemesterId"
    ) {
      value = cleanPositiveId(value);
      if (value === undefined) {
        return {
          error: `${inputField} must be a valid positive ID or null.`,
        };
      }
    } else if (inputField === "totalCredits") {
      value = cleanNonNegativeInteger(value);
      if (value === undefined) {
        return {
          error: "totalCredits must be a non-negative integer.",
        };
      }
    } else {
      value = cleanOptionalText(value);
    }

    if (
      (inputField === "academicLevel" || inputField === "studentType") &&
      value
    ) {
      value = value.toLowerCase();
    }

    if (inputField === "academicLevel" && value && !ACADEMIC_LEVELS.has(value)) {
      return {
        error:
          "academicLevel must be freshman, sophomore, junior, senior, or graduate.",
      };
    }

    if (inputField === "studentType" && value && !STUDENT_TYPES.has(value)) {
      return {
        error:
          "studentType must be first-time, continuing, transfer, or international.",
      };
    }

    if (inputField === "schoolStudentId" && !value) {
      return {
        error: "schoolStudentId cannot be empty.",
      };
    }

    addStudentUpdate(studentUpdates, studentValues, dbField, dbValue(value));
  }

  if (Object.prototype.hasOwnProperty.call(body, "institutionalEmail")) {
    const institutionalEmail = cleanEmail(body.institutionalEmail);
    if (!institutionalEmail) {
      return {
        error: "institutionalEmail cannot be empty.",
      };
    }

    addStudentUpdate(
      appUserUpdates,
      appUserValues,
      "institutional_email",
      institutionalEmail
    );
  }

  return {
    studentUpdates,
    studentValues,
    appUserUpdates,
    appUserValues,
  };
}

async function getStudentProfile(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const profile = await loadStudentProfile(req.auth.userId);
    if (!profile) {
      return res.status(404).json({
        message: "Student profile not found.",
      });
    }

    return res.json({
      student: studentProfileRow(profile),
    });
  } catch (error) {
    console.error("Unable to load student profile:", error.message);

    return res.status(500).json({
      message: "Unable to load student profile.",
    });
  }
}

async function listStudentSemesters(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         sem.semester_id,
         sem.term_year,
         sem.term_type,
         sem.start_date,
         sem.end_date,
         sem.add_drop_deadline,
         sem.withdrawal_deadline,
         sem.is_active,
         ew.enrollment_start,
         ew.enrollment_end
       FROM public.student st
       JOIN public.app_user u ON u.user_id = st.student_id
       JOIN public.semester sem ON sem.school_id = u.school_id
       LEFT JOIN public.enrollment_window ew
         ON ew.semester_id = sem.semester_id
        AND ew.student_type = st.student_type
        AND ew.academic_level = st.academic_level
       WHERE st.student_id = $1
       ORDER BY sem.term_year DESC,
         CASE sem.term_type
           WHEN 'Winter' THEN 1
           WHEN 'Spring' THEN 2
           WHEN 'Summer' THEN 3
           WHEN 'Fall' THEN 4
         END DESC`,
      [req.auth.userId]
    );

    return res.json({
      semesters: result.rows.map((row) => ({
        semesterId: row.semester_id,
        year: row.term_year,
        type: row.term_type,
        startDate: row.start_date,
        endDate: row.end_date,
        addDropDeadline: row.add_drop_deadline,
        withdrawalDeadline: row.withdrawal_deadline,
        enrollmentStart: row.enrollment_start,
        enrollmentEnd: row.enrollment_end,
        isActive: row.is_active,
      })),
    });
  } catch (error) {
    console.error("Unable to load student semesters:", error.message);
    return res.status(500).json({ message: "Unable to load student semesters." });
  }
}

async function updateStudentProfile(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const { updates, values, error } = validateStudentEditableBody(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  if (!updates.length) {
    return res.status(400).json({
      message:
        "At least one editable field is required: phoneNumber, street, city, state, zipCode, or walkingSpeedMps.",
    });
  }

  values.push(req.auth.userId);

  try {
    const updated = await pool.query(
      `UPDATE public.student
       SET ${updates.join(", ")}
       WHERE student_id = $${values.length}
       RETURNING student_id`,
      values
    );

    if (!updated.rows.length) {
      return res.status(404).json({
        message: "Student profile not found.",
      });
    }

    const profile = await loadStudentProfile(req.auth.userId);
    return res.json({
      student: studentProfileRow(profile),
    });
  } catch (error) {
    console.error("Unable to update student profile:", error.message);

    return res.status(500).json({
      message: "Unable to update student profile.",
    });
  }
}

async function updateStudentAcademicProfile(req, res) {
  const studentId = cleanPositiveId(req.params.studentId);

  if (!studentId) {
    return res.status(400).json({
      message: "A valid studentId is required.",
    });
  }

  const validation = validateAdminStudentBody(req.body);
  if (validation.error) {
    return res.status(400).json({
      message: validation.error,
    });
  }

  const {
    studentUpdates,
    studentValues,
    appUserUpdates,
    appUserValues,
  } = validation;

  if (!studentUpdates.length && !appUserUpdates.length) {
    return res.status(400).json({
      message:
        "At least one academic field is required: schoolStudentId, institutionalEmail, degreeProgramId, expectedGraduationSemesterId, academicLevel, studentType, or totalCredits.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT student_id
       FROM public.student
       WHERE student_id = $1
       FOR UPDATE`,
      [studentId]
    );

    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Student profile not found.",
      });
    }

    if (studentUpdates.length) {
      studentValues.push(studentId);
      await client.query(
        `UPDATE public.student
         SET ${studentUpdates.join(", ")}
         WHERE student_id = $${studentValues.length}`,
        studentValues
      );
    }

    if (appUserUpdates.length) {
      appUserValues.push(studentId);
      await client.query(
        `UPDATE public.app_user
         SET ${appUserUpdates.join(", ")}
         WHERE user_id = $${appUserValues.length}
           AND user_role = 'student'`,
        appUserValues
      );
    }

    await client.query("COMMIT");

    const profile = await loadStudentProfile(studentId);
    return res.json({
      student: studentProfileRow(profile),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Student ID or institutional email already exists.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        message:
          "degreeProgramId or expectedGraduationSemesterId does not exist.",
      });
    }

    console.error("Unable to update academic profile:", error.message);

    return res.status(500).json({
      message: "Unable to update academic profile.",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getStudentProfile,
  listStudentSemesters,
  updateStudentProfile,
  updateStudentAcademicProfile,
};
