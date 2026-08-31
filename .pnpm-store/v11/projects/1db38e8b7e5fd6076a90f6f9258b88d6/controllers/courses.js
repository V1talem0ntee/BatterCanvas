const { pool } = require("../db");

// Expand with cart functionalities later
function courseRow(row) {
  return {
    courseId: row.course_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    description: row.course_description,
    units: row.course_units,
    category: row.course_category || ((row.ge_area_codes || []).length ? "ge" : "major-core"),
    geAreas: row.ge_area_codes || [],
    section: row.class_section_id
      ? {
          classSectionId: row.class_section_id,
          sectionNumber: row.section_number,
          modality: row.modality,
          status: row.section_status,
          capacity: row.capacity,
          enrolledCount: row.enrolled_count,
          availableSeats: row.capacity - row.enrolled_count,

          meetingDays: row.meeting_days,

          meetingStartTime: row.meeting_start_time,
          meetingEndTime: row.meeting_end_time,

          instructor: row.instructor_first_name
            ? {
                firstName: row.instructor_first_name,
                lastName: row.instructor_last_name,
                email: row.instructor_email,
              }
            : null,

          location: row.building_name
            ? {
                buildingName: row.building_name,
                roomNumber: row.room_number,
                mapElementId: row.map_element_id,
                buildingTypes: row.building_types || [],
              }
            : null,
        }
      : null,
  };
}

function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value) {
  return String(value || "").trim();
}

function addWhere(where, values, sql, value) {
  values.push(value);
  where.push(sql.replace("?", "$" + values.length));
}

function sectionRow(row) {
  return {
    classSectionId: row.class_section_id,
    semesterId: row.semester_id,
    sectionNumber: row.section_number,
    modality: row.modality,
    meetingType: row.meeting_type,
    status: row.section_status,
    capacity: row.capacity,
    enrolledCount: row.enrolled_count,
    waitlistCapacity: row.waitlist_capacity,
    waitlistCount: row.waitlist_count,
    availableSeats: row.capacity - row.enrolled_count,
    meetingStartTime: row.meeting_start_time,
    meetingEndTime: row.meeting_end_time,
    meetingDays: row.meeting_days || [],
    term: {
      semesterId: row.semester_id,
      year: row.term_year,
      type: row.term_type,
    },
    instructor: {
      firstName: row.instructor_first_name,
      lastName: row.instructor_last_name,
      email: row.instructor_email,
    },
    location: row.building_name
      ? {
          buildingName: row.building_name,
          roomNumber: row.room_number,
          mapElementId: row.map_element_id,
          buildingTypes: row.building_types || [],
        }
      : null,
  };
}

function courseDetailRow(course, sections, geAreas, prerequisites) {
  return {
    courseId: course.course_id,
    subjectCode: course.subject_code,
    courseNumber: course.course_number,
    title: course.course_title,
    description: course.course_description,
    units: course.course_units,
    level: course.course_level,
    repeatable: course.repeatable,
    sectionType: course.section_type,
    department: {
      departmentId: course.department_id,
      name: course.department_name,
      officeEmail: course.office_email,
      officePhone: course.office_phone,
    },
    geAreas,
    prerequisites,
    sections,
  };
}

async function listCourses(req, res) {
  const search = cleanText(req.query.search);
  const subjectCode = cleanText(req.query.subjectCode);
  const courseNumber = cleanText(req.query.courseNumber);
  const modality = cleanText(req.query.modality);
  const status = cleanText(req.query.status);
  const meetingType = cleanText(req.query.meetingType);
  const level = cleanText(req.query.level);
  const sectionType = cleanText(req.query.sectionType);
  const courseCategory = cleanText(req.query.courseCategory);
  const geAreaId = req.query.geAreaId ? cleanId(req.query.geAreaId) : null;
  const departmentId = req.query.departmentId
    ? cleanId(req.query.departmentId)
    : null;
  const semesterId = req.query.semesterId
    ? cleanId(req.query.semesterId)
    : null;
  const units = req.query.units ? Number(req.query.units) : null;
  const values = [];

  if (
    (req.query.departmentId && !departmentId) ||
    (req.query.semesterId && !semesterId) ||
    (req.query.units && (!Number.isInteger(units) || units <= 0)) ||
    (req.query.geAreaId && !geAreaId) ||
    (courseCategory && !["major-core", "major-elective", "ge"].includes(courseCategory))
  ) {
    return res.status(400).json({
      message:
        "departmentId, semesterId, geAreaId, units, and courseCategory must be valid.",
    });
  }

  const where = [];

  if (search) {
    addWhere(
      where,
      values,
      `(LOWER(c.subject_code) LIKE ?
         OR LOWER(c.course_number) LIKE ?
         OR LOWER(c.course_title) LIKE ?
         OR LOWER(c.course_description) LIKE ?
         OR LOWER(d.department_name) LIKE ?
         OR LOWER(c.subject_code || ' ' || c.course_number) LIKE ?)`,
      `%${search.toLowerCase()}%`
    );

    const searchIndex = "$" + values.length;
    where[where.length - 1] = where[where.length - 1].replaceAll(
      "?",
      searchIndex
    );
  }

  if (subjectCode) {
    addWhere(
      where,
      values,
      "LOWER(c.subject_code) = ?",
      subjectCode.toLowerCase()
    );
  }

  if (courseNumber) {
    addWhere(
      where,
      values,
      "LOWER(c.course_number) = ?",
      courseNumber.toLowerCase()
    );
  }

  if (departmentId) {
    addWhere(where, values, "c.department_id = ?", departmentId);
  }

  if (semesterId) {
    addWhere(where, values, "cs.semester_id = ?", semesterId);
  }

  if (modality) {
    addWhere(where, values, "cs.modality = ?", modality.toLowerCase());
  }

  if (status) {
    addWhere(where, values, "cs.section_status = ?", status.toLowerCase());
  }

  if (meetingType) {
    addWhere(where, values, "cs.meeting_type = ?", meetingType.toLowerCase());
  }

  if (units) {
    addWhere(where, values, "c.course_units = ?", units);
  }

  if (level) {
    addWhere(where, values, "c.course_level = ?", level.toLowerCase().replaceAll("-", "_"));
  }

  if (sectionType) {
    addWhere(where, values, "c.section_type = ?", sectionType.toLowerCase());
  }
  if (courseCategory === "major-core") {
    where.push("c.course_category = 'major-core'");
  } else if (courseCategory === "major-elective") {
    where.push("c.course_category = 'major-elective'");
  } else if (courseCategory === "ge") {
    where.push("c.course_category = 'ge'");
  }
  if (geAreaId) {
    addWhere(where, values, "EXISTS (SELECT 1 FROM public.course_ge_area area_cga WHERE area_cga.course_id = c.course_id AND area_cga.ge_area_id = ?)", geAreaId);
  }

  try {
    const result = await pool.query(
      `SELECT
        c.course_id,
        c.subject_code,
        c.course_number,
        c.course_title,
        c.course_description,
        c.course_units,
        c.course_level,
        c.course_category,
        c.section_type,
        ARRAY(SELECT ga.ge_area_code FROM public.course_ge_area cga JOIN public.ge_area ga ON ga.ge_area_id = cga.ge_area_id WHERE cga.course_id = c.course_id ORDER BY ga.ge_area_code) AS ge_area_codes,
        d.department_id,
        d.department_name,

        cs.class_section_id,
        cs.section_number,
        cs.modality,
        cs.section_status,
        cs.capacity,
        cs.enrolled_count,
        cs.meeting_start_time,
        cs.meeting_end_time,

        i.first_name AS instructor_first_name,
        i.last_name AS instructor_last_name,
        i.institutional_email AS instructor_email,

        b.building_name,
        b.map_element_id,
        cr.room_number,

        ARRAY(
          SELECT bt.building_type
          FROM public.building_type bt
          WHERE bt.building_id = b.building_id
          ORDER BY bt.building_type
        ) AS building_types,

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

      FROM public.course c
      JOIN public.department d
        ON d.department_id = c.department_id

      JOIN public.class_section cs
        ON cs.course_id = c.course_id

      LEFT JOIN public.instructor i
        ON i.instructor_id = cs.instructor_id

      LEFT JOIN public.classroom cr
        ON cr.classroom_id = cs.classroom_id

      LEFT JOIN public.building b
        ON b.building_id = cr.building_id

      ${where.length ? "WHERE " + where.join(" AND ") : ""}

      ORDER BY
        c.subject_code,
        c.course_number,
        cs.section_number

      LIMIT 100`,
      values
    );

    return res.json({
      courses: result.rows.map(courseRow),
    });
  } catch (error) {
    console.error("Unable to load courses:", error.message);

    return res.status(500).json({
      message: "Unable to load courses.",
    });
  }
}

module.exports = {
  listCourses,
};
