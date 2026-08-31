const { pool } = require("../db");

function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function semesterRow(row) {
  return {
    semesterId: row.semester_id,
    schoolId: row.school_id,
    year: row.term_year,
    type: row.term_type,
    startDate: row.start_date,
    endDate: row.end_date,
    addDropDeadline: row.add_drop_deadline,
    withdrawalDeadline: row.withdrawal_deadline,
    isActive: row.is_active,
  };
}

function departmentRow(row) {
  return {
    departmentId: row.department_id,
    name: row.department_name,
    officeEmail: row.office_email,
    officePhone: row.office_phone,
    building: row.building_id
      ? {
          buildingId: row.building_id,
          name: row.building_name,
        }
      : null,
  };
}

function departmentCourseRow(row) {
  return {
    courseId: row.course_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    description: row.course_description,
    units: row.course_units,
    level: row.course_level,
    repeatable: row.repeatable,
    sectionType: row.section_type,
  };
}

function buildingRow(row) {
  return {
    buildingId: row.building_id,
    name: row.building_name,
    mapElementId: row.map_element_id,
    types: row.building_types || [],
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

async function listSemesters(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        semester_id,
        school_id,
        term_year,
        term_type,
        start_date,
        end_date,
        add_drop_deadline,
        withdrawal_deadline,
        is_active
      FROM public.semester
      ORDER BY term_year DESC,
        CASE term_type
          WHEN 'Winter' THEN 1
          WHEN 'Spring' THEN 2
          WHEN 'Summer' THEN 3
          WHEN 'Fall' THEN 4
        END DESC`
    );

    return res.json({
      semesters: result.rows.map(semesterRow),
    });
  } catch (error) {
    console.error("Unable to load semesters:", error.message);

    return res.status(500).json({
      message: "Unable to load semesters.",
    });
  }
}

async function listGeAreas(req, res) {
  try {
    const result = await pool.query(
      "SELECT ge_area_id, ge_area_code, ge_area_name FROM public.ge_area ORDER BY ge_area_code"
    );
    return res.json({ geAreas: result.rows.map((row) => ({
      geAreaId: row.ge_area_id,
      code: row.ge_area_code,
      name: row.ge_area_name,
    })) });
  } catch (error) {
    console.error("Unable to load GE areas:", error.message);
    return res.status(500).json({ message: "Unable to load GE areas." });
  }
}

async function getSemester(req, res) {
  const semesterId = cleanId(req.params.semesterId);

  if (!semesterId) {
    return res.status(400).json({
      message: "A valid semesterId is required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        semester_id,
        school_id,
        term_year,
        term_type,
        start_date,
        end_date,
        add_drop_deadline,
        withdrawal_deadline,
        is_active
      FROM public.semester
      WHERE semester_id = $1`,
      [semesterId]
    );

    const semester = result.rows[0];
    if (!semester) {
      return res.status(404).json({
        message: "Semester not found.",
      });
    }

    return res.json({
      semester: semesterRow(semester),
    });
  } catch (error) {
    console.error("Unable to load semester:", error.message);

    return res.status(500).json({
      message: "Unable to load semester.",
    });
  }
}

async function listDepartments(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        d.department_id,
        d.department_name,
        d.office_email,
        d.office_phone,
        b.building_id,
        b.building_name
      FROM public.department d
      LEFT JOIN public.building b
        ON b.building_id = d.building_id
      ORDER BY d.department_name`
    );

    return res.json({
      departments: result.rows.map(departmentRow),
    });
  } catch (error) {
    console.error("Unable to load departments:", error.message);

    return res.status(500).json({
      message: "Unable to load departments.",
    });
  }
}

async function listDepartmentCourses(req, res) {
  const departmentId = cleanId(req.params.departmentId);

  if (!departmentId) {
    return res.status(400).json({
      message: "A valid departmentId is required.",
    });
  }

  try {
    const departmentResult = await pool.query(
      `SELECT
        d.department_id,
        d.department_name,
        d.office_email,
        d.office_phone,
        b.building_id,
        b.building_name
      FROM public.department d
      LEFT JOIN public.building b
        ON b.building_id = d.building_id
      WHERE d.department_id = $1`,
      [departmentId]
    );

    const department = departmentResult.rows[0];
    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    const courseResult = await pool.query(
      `SELECT
        course_id,
        subject_code,
        course_number,
        course_title,
        course_description,
        course_units,
        course_level,
        repeatable,
        section_type
      FROM public.course
      WHERE department_id = $1
      ORDER BY subject_code, course_number`,
      [departmentId]
    );

    return res.json({
      department: departmentRow(department),
      courses: courseResult.rows.map(departmentCourseRow),
    });
  } catch (error) {
    console.error("Unable to load department courses:", error.message);

    return res.status(500).json({
      message: "Unable to load department courses.",
    });
  }
}

async function listBuildings(req, res) {
  const type = cleanText(req.query.type);
  const values = [];
  let having = "";

  if (type) {
    values.push(type);
    having = `HAVING $1 = ANY(ARRAY_REMOVE(ARRAY_AGG(bt.building_type), NULL))`;
  }

  try {
    const result = await pool.query(
      `SELECT
        b.building_id,
        b.building_name,
        b.map_element_id,
        ARRAY_REMOVE(ARRAY_AGG(bt.building_type ORDER BY bt.building_type), NULL)
          AS building_types
      FROM public.building b
      LEFT JOIN public.building_type bt
        ON bt.building_id = b.building_id
      GROUP BY
        b.building_id,
        b.building_name,
        b.map_element_id
      ${having}
      ORDER BY b.building_name`,
      values
    );

    return res.json({
      buildings: result.rows.map(buildingRow),
    });
  } catch (error) {
    console.error("Unable to load buildings:", error.message);

    return res.status(500).json({
      message: "Unable to load buildings.",
    });
  }
}

module.exports = {
  listSemesters,
  listGeAreas,
  getSemester,
  listDepartments,
  listDepartmentCourses,
  listBuildings,
};
