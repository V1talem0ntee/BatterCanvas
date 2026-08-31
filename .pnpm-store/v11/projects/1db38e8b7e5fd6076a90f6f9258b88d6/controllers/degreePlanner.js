const { pool } = require("../db");

function requireStudent(req, res) {
  if (req.auth.role !== "student") {
    res.status(403).json({ message: "Student access required." });
    return false;
  }

  return true;
}

function categoryForRequirement(requirementType) {
  if (requirementType === "major-core") {
    return "Major";
  }

  if (requirementType === "major-elective") {
    return "Elective";
  }

  return "GE";
}

function categoryPriority(requirementType) {
  const priorities = {
    "major-core": 1,
    "major-elective": 2,
    "ge-area": 3,
    "university-requirement": 4,
  };

  return priorities[requirementType] || 5;
}

function courseNumberValue(courseNumber) {
  const number = Number.parseInt(String(courseNumber), 10);

  if (Number.isNaN(number)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return number;
}

function termOrderValue(termName) {
  const termOrder = {
    Fall: 1,
    Winter: 2,
    Spring: 3,
    Summer: 4,
  };

  return termOrder[termName] || 99;
}

async function ensureDefaultDegreePlanTerms(studentId) {
  const existingResult = await pool.query(
    `SELECT COUNT(*) AS term_count
     FROM public.student_plan_term
     WHERE student_id = $1`,
    [studentId],
  );

  if (Number(existingResult.rows[0].term_count) > 0) {
    return;
  }

  const defaultTerms = [
    [studentId, 1, "Fall", 1],
    [studentId, 1, "Spring", 3],
    [studentId, 2, "Fall", 1],
    [studentId, 2, "Spring", 3],
    [studentId, 3, "Fall", 1],
    [studentId, 3, "Spring", 3],
    [studentId, 4, "Fall", 1],
    [studentId, 4, "Spring", 3],
  ];

  for (const term of defaultTerms) {
    await pool.query(
      `INSERT INTO public.student_plan_term
         (student_id, term_year, term_type, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, term_year, term_type)
       DO NOTHING`,
      term,
    );
  }
}

async function getSavedDegreePlanTerms(studentId) {
  const result = await pool.query(
    `SELECT
       pt.plan_term_id,
       COALESCE(rt.year_number, pt.term_year) AS year_number,
       pt.term_type AS term_name,
       pt.display_order AS term_order,

       pi.plan_item_id AS plan_course_id,
       ROW_NUMBER() OVER (
         PARTITION BY pt.plan_term_id
         ORDER BY pi.plan_item_id
       ) - 1 AS course_order,

       c.course_id,
       c.subject_code,
       c.course_number,
       c.course_title,
       c.course_description,
       c.course_units
     FROM public.student_plan_term pt
     LEFT JOIN public.degree_roadmap_term rt
       ON rt.roadmap_term_id = pt.roadmap_term_id
     LEFT JOIN public.student_plan_item pi
       ON pi.plan_term_id = pt.plan_term_id
     LEFT JOIN public.course c
       ON c.course_id = pi.selected_course_id
     WHERE pt.student_id = $1
     ORDER BY
       COALESCE(rt.year_number, pt.term_year),
       pt.display_order,
       pi.plan_item_id,
       c.subject_code,
       c.course_number`,
    [studentId],
  );

  const termMap = new Map();

  for (const row of result.rows) {
    const termId = Number(row.plan_term_id);

    if (!termMap.has(termId)) {
      termMap.set(termId, {
        planTermId: termId,
        yearNumber: Number(row.year_number),
        termName: row.term_name,
        termOrder: Number(row.term_order),
        courses: [],
      });
    }

    if (row.course_id) {
      termMap.get(termId).courses.push({
        planCourseId: Number(row.plan_course_id),
        courseOrder: Number(row.course_order),
        courseId: Number(row.course_id),
        subjectCode: row.subject_code,
        courseNumber: row.course_number,
        title: row.course_title,
        description: row.course_description,
        units: Number(row.course_units),
      });
    }
  }

  return Array.from(termMap.values());
}

async function getDegreePlanner(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const programResult = await pool.query(
      `SELECT
         dp.degree_program_id,
         dp.degree_type,
         dp.catalog_year,
         dp.required_major_units,
         dp.required_ge_units,
         m.major_id,
         m.major_name,
         d.department_id,
         d.department_name
       FROM public.student s
       JOIN public.degree_program dp
         ON dp.degree_program_id = s.degree_program_id
       JOIN public.major m
         ON m.major_id = dp.major_id
       JOIN public.department d
         ON d.department_id = m.department_id
       WHERE s.student_id = $1`,
      [req.auth.userId],
    );

    if (!programResult.rows.length) {
      return res.status(404).json({
        message: "No degree program is assigned to this student.",
      });
    }

    await ensureDefaultDegreePlanTerms(req.auth.userId);

    const program = programResult.rows[0];

    const requirementResult = await pool.query(
      `SELECT
         dr.degree_requirement_id,
         dr.degree_program_id,
         dr.ge_area_id,
         ga.ge_area_code,
         dr.requirement_name,
         dr.requirement_type,
         dr.completion_rule,
         dr.required_units,
         dr.minimum_grade
       FROM public.degree_requirement dr
       LEFT JOIN public.ge_area ga
         ON ga.ge_area_id = dr.ge_area_id
       WHERE dr.degree_program_id = $1
       ORDER BY
         CASE dr.requirement_type
           WHEN 'major-core' THEN 1
           WHEN 'major-elective' THEN 2
           WHEN 'ge-area' THEN 3
           WHEN 'university-requirement' THEN 4
           ELSE 5
         END,
         dr.requirement_name`,
      [program.degree_program_id],
    );

    const courseResult = await pool.query(
      `WITH roadmap_courses AS (
         SELECT
           dr.degree_requirement_id,
           dr.requirement_name,
           dr.requirement_type,
           dr.required_units,
           dr.completion_rule,
           dr.minimum_grade,
           ga.ge_area_code,
           c.course_id,
           c.subject_code,
           c.course_number,
           c.course_title,
           c.course_description,
           c.course_units,
           c.course_level,
           c.section_type
         FROM public.degree_requirement dr
         LEFT JOIN public.ge_area ga
           ON ga.ge_area_id = dr.ge_area_id
         JOIN public.required_course rc
           ON rc.requirement_id = dr.degree_requirement_id
         JOIN public.course c
           ON c.course_id = rc.course_id
         WHERE dr.degree_program_id = $1

         UNION

         SELECT
           dr.degree_requirement_id,
           dr.requirement_name,
           dr.requirement_type,
           dr.required_units,
           dr.completion_rule,
           dr.minimum_grade,
           ga.ge_area_code,
           c.course_id,
           c.subject_code,
           c.course_number,
           c.course_title,
           c.course_description,
           c.course_units,
           c.course_level,
           c.section_type
         FROM public.degree_requirement dr
         JOIN public.ge_area ga
           ON ga.ge_area_id = dr.ge_area_id
         JOIN public.course_ge_area cga
           ON cga.ge_area_id = dr.ge_area_id
         JOIN public.course c
           ON c.course_id = cga.course_id
         WHERE dr.degree_program_id = $1
           AND dr.requirement_type = 'ge-area'
      )
       SELECT *
       FROM roadmap_courses
       ORDER BY
         CASE requirement_type
           WHEN 'major-core' THEN 1
           WHEN 'major-elective' THEN 2
           WHEN 'ge-area' THEN 3
           WHEN 'university-requirement' THEN 4
           ELSE 5
         END,
         requirement_name,
         subject_code,
         course_number`,
      [program.degree_program_id],
    );

    const completedResult = await pool.query(
      `SELECT DISTINCT cs.course_id
       FROM public.enrollment e
       JOIN public.class_section cs
         ON cs.class_section_id = e.class_section_id
       WHERE e.student_id = $1
         AND e.enrollment_status = 'completed'
         AND (
           e.grade IS NULL
           OR e.grade NOT IN ('F', 'NP')
         )`,
      [req.auth.userId],
    );

    const enrolledResult = await pool.query(
      `SELECT DISTINCT cs.course_id
       FROM public.enrollment e
       JOIN public.class_section cs
         ON cs.class_section_id = e.class_section_id
       WHERE e.student_id = $1
         AND e.enrollment_status = 'enrolled'`,
      [req.auth.userId],
    );

    const completedCourseIds = new Set(
      completedResult.rows.map((row) => {
        return Number(row.course_id);
      }),
    );

    const enrolledCourseIds = new Set(
      enrolledResult.rows.map((row) => {
        return Number(row.course_id);
      }),
    );

    const uniqueCourses = new Map();

    for (const row of courseResult.rows) {
      const courseId = Number(row.course_id);
      const savedCourse = uniqueCourses.get(courseId);

      if (
        savedCourse &&
        categoryPriority(savedCourse.requirementType) <=
          categoryPriority(row.requirement_type)
      ) {
        continue;
      }

      uniqueCourses.set(courseId, {
        courseId,
        subjectCode: row.subject_code,
        courseNumber: row.course_number,
        title: row.course_title,
        description: row.course_description,
        units: Number(row.course_units),
        level: row.course_level,
        sectionType: row.section_type,
        category: categoryForRequirement(row.requirement_type),
        requirementId: Number(row.degree_requirement_id),
        requirement: row.requirement_name,
        requirementType: row.requirement_type,
        geAreaCode: row.ge_area_code,
        requiredUnits: Number(row.required_units),
        completionRule: row.completion_rule,
        minimumGrade: row.minimum_grade,
        suggested: false,
      });
    }

    const remainingCourses = Array.from(uniqueCourses.values()).filter(
      (course) => {
        return (
          !completedCourseIds.has(course.courseId) &&
          !enrolledCourseIds.has(course.courseId)
        );
      },
    );

    const remainingCourseIds = remainingCourses.map((course) => {
      return course.courseId;
    });

    let prerequisiteRows = [];

    if (remainingCourseIds.length > 0) {
      const prerequisiteResult = await pool.query(
        `SELECT
           course_id,
           prerequisite_course_id
         FROM public.course_prerequisite
         WHERE course_id = ANY($1::bigint[])`,
        [remainingCourseIds],
      );

      prerequisiteRows = prerequisiteResult.rows;
    }

    const prerequisitesByCourse = new Map();

    for (const row of prerequisiteRows) {
      const courseId = Number(row.course_id);
      const prerequisiteId = Number(row.prerequisite_course_id);

      if (!prerequisitesByCourse.has(courseId)) {
        prerequisitesByCourse.set(courseId, []);
      }

      prerequisitesByCourse.get(courseId).push(prerequisiteId);
    }

    const suggestedCourseIds = remainingCourses
      .filter((course) => {
        const prerequisites = prerequisitesByCourse.get(course.courseId) || [];

        return prerequisites.every((prerequisiteCourseId) => {
          return completedCourseIds.has(prerequisiteCourseId);
        });
      })
      .sort((firstCourse, secondCourse) => {
        const categoryDifference =
          categoryPriority(firstCourse.requirementType) -
          categoryPriority(secondCourse.requirementType);

        if (categoryDifference !== 0) {
          return categoryDifference;
        }

        const subjectDifference = firstCourse.subjectCode.localeCompare(
          secondCourse.subjectCode,
        );

        if (subjectDifference !== 0) {
          return subjectDifference;
        }

        return (
          courseNumberValue(firstCourse.courseNumber) -
          courseNumberValue(secondCourse.courseNumber)
        );
      })
      .map((course) => {
        return course.courseId;
      });

    const suggestedSet = new Set(suggestedCourseIds);

    const requirements = requirementResult.rows.map((row) => {
      return {
        degreeRequirementId: Number(row.degree_requirement_id),
        degreeProgramId: Number(row.degree_program_id),
        geAreaId: row.ge_area_id ? Number(row.ge_area_id) : null,
        geAreaCode: row.ge_area_code,
        name: row.requirement_name,
        type: row.requirement_type,
        completionRule: row.completion_rule,
        requiredUnits: Number(row.required_units),
        minimumGrade: row.minimum_grade,
      };
    });

    const savedTerms = await getSavedDegreePlanTerms(req.auth.userId);

    return res.json({
      degreeProgram: {
        degreeProgramId: Number(program.degree_program_id),
        majorId: Number(program.major_id),
        majorName: program.major_name,
        departmentId: Number(program.department_id),
        departmentName: program.department_name,
        degreeType: program.degree_type,
        catalogYear: Number(program.catalog_year),
        requiredMajorUnits: Number(program.required_major_units),
        requiredGeUnits: Number(program.required_ge_units),
      },
      requirements,
      courses: remainingCourses.map((course) => {
        return {
          ...course,
          suggested: suggestedSet.has(course.courseId),
        };
      }),
      savedTerms,
    });
  } catch (error) {
    console.error("Unable to load degree planner:", error.message);

    return res.status(500).json({
      message: "Unable to load the degree planner.",
    });
  }
}

async function addDegreePlanTerm(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const yearNumber = Number(req.body.yearNumber);
  const termName = String(req.body.termName || "").trim();

  if (
    !Number.isInteger(yearNumber) ||
    yearNumber <= 0 ||
    yearNumber > 8 ||
    !["Fall", "Winter", "Spring", "Summer"].includes(termName)
  ) {
    return res.status(400).json({
      message: "yearNumber and termName are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.student_plan_term
         (student_id, term_year, term_type, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, term_year, term_type)
       DO UPDATE SET display_order = EXCLUDED.display_order
       RETURNING plan_term_id, term_year, term_type, display_order`,
      [req.auth.userId, yearNumber, termName, termOrderValue(termName)],
    );

    return res.status(201).json({
      term: {
        planTermId: Number(result.rows[0].plan_term_id),
        yearNumber: Number(result.rows[0].term_year),
        termName: result.rows[0].term_type,
        termOrder: Number(result.rows[0].display_order),
        courses: [],
      },
    });
  } catch (error) {
    console.error("Unable to add degree plan term:", error.message);

    return res.status(500).json({
      message: "Unable to add degree plan term.",
    });
  }
}

async function addYeartoDegreeplanner(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const yearNumber = Number(req.body.year);

  if (!Number.isInteger(yearNumber) || yearNumber <= 0 || yearNumber > 8) {
    return res.status(400).json({
      message: "year must be between 1 and 8.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const fallresult = await client.query(
      `INSERT INTO public.student_plan_term

         (student_id, term_year, term_type, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, term_year, term_type)

       DO UPDATE SET display_order = EXCLUDED.display_order

       RETURNING plan_term_id, term_year, term_type, display_order`,
      [req.auth.userId, yearNumber, "Fall", termOrderValue("Fall")],
    );

    const springresult = await client.query(
      `INSERT INTO public.student_plan_term
         (student_id, term_year, term_type, display_order)
       VALUES ($1, $2, $3, $4)

       ON CONFLICT (student_id, term_year, term_type)

       DO UPDATE SET display_order = EXCLUDED.display_order
       RETURNING plan_term_id, term_year, term_type, display_order`,

      [req.auth.userId, yearNumber, "Spring", termOrderValue("Spring")],
    );

    await client.query("COMMIT");

    const rows = [fallresult.rows[0], springresult.rows[0]];

    const terms = rows.map((row) => ({
      newtermid: Number(row.plan_term_id),

      yearNumber: Number(row.term_year),

      termName: row.term_type,
      termOrder: Number(row.display_order),

      courses: [],
    }));

    return res.status(201).json({
      year: {
        yearNumber,

        terms,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Unable to add year:", error.message);

    return res.status(500).json({
      message: "Unable to add  year.",
    });
  } finally {
    client.release();
  }
}

async function removeDegreePlanTerm(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const planTermId = Number(req.params.planTermId);

  if (!Number.isInteger(planTermId) || planTermId <= 0) {
    return res.status(400).json({
      message: "planTermId must be valid.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.student_plan_term
       WHERE plan_term_id = $1
         AND student_id = $2
       RETURNING plan_term_id`,
      [planTermId, req.auth.userId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Degree plan term not found.",
      });
    }

    return res.json({
      message: "Degree plan term removed.",
    });
  } catch (error) {
    console.error("Unable to remove degree plan term:", error.message);

    return res.status(500).json({
      message: "Unable to remove degree plan term.",
    });
  }
}

async function saveDegreePlanCourse(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const courseId = Number(req.body.courseId);
  const yearNumber = Number(req.body.yearNumber);
  const termName = String(req.body.termName || "").trim();
  const courseOrder = Number(req.body.courseOrder) || 0;

  if (
    !Number.isInteger(courseId) ||
    courseId <= 0 ||
    !Number.isInteger(yearNumber) ||
    yearNumber <= 0 ||
    yearNumber > 8 ||
    !["Fall", "Winter", "Spring", "Summer"].includes(termName)
  ) {
    return res.status(400).json({
      message: "courseId, yearNumber, and termName are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const courseResult = await client.query(
      `SELECT course_id
       FROM public.course
       WHERE course_id = $1`,
      [courseId],
    );

    if (!courseResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    const termResult = await client.query(
      `INSERT INTO public.student_plan_term
         (student_id, term_year, term_type, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, term_year, term_type)
       DO UPDATE SET display_order = EXCLUDED.display_order
       RETURNING plan_term_id`,
      [req.auth.userId, yearNumber, termName, termOrderValue(termName)],
    );

    const planTermId = Number(termResult.rows[0].plan_term_id);

    const existingResult = await client.query(
      `SELECT pi.plan_item_id
       FROM public.student_plan_item pi
       JOIN public.student_plan_term pt
         ON pt.plan_term_id = pi.plan_term_id
       WHERE pt.student_id = $1
         AND pi.selected_course_id = $2
       FOR UPDATE`,
      [req.auth.userId, courseId],
    );

    let result;

    if (existingResult.rows.length) {
      result = await client.query(
        `UPDATE public.student_plan_item
         SET plan_term_id = $1
         WHERE plan_item_id = $2
         RETURNING plan_item_id, plan_term_id, selected_course_id`,
        [planTermId, existingResult.rows[0].plan_item_id],
      );
    } else {
      result = await client.query(
        `INSERT INTO public.student_plan_item
           (plan_term_id, selected_course_id)
         VALUES ($1, $2)
         RETURNING plan_item_id, plan_term_id, selected_course_id`,
        [planTermId, courseId],
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      plannedCourse: {
        planCourseId: Number(result.rows[0].plan_item_id),
        planTermId: Number(result.rows[0].plan_term_id),
        courseId: Number(result.rows[0].selected_course_id),
        courseOrder,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Unable to save degree plan course:", error.message);

    return res.status(500).json({
      message: "Unable to save degree plan course.",
    });
  } finally {
    client.release();
  }
}

async function removeDegreePlanCourse(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  const courseId = Number(req.params.courseId);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({
      message: "courseId must be valid.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.student_plan_item pi
       USING public.student_plan_term pt
       WHERE pi.plan_term_id = pt.plan_term_id
         AND pt.student_id = $1
         AND pi.selected_course_id = $2
       RETURNING pi.plan_item_id`,
      [req.auth.userId, courseId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Degree plan course not found.",
      });
    }

    return res.json({
      message: "Degree plan course removed.",
    });
  } catch (error) {
    console.error("Unable to remove degree plan course:", error.message);

    return res.status(500).json({
      message: "Unable to remove degree plan course.",
    });
  }
}

module.exports = {
  getDegreePlanner,
  addYeartoDegreeplanner,
  addDegreePlanTerm,
  removeDegreePlanTerm,
  saveDegreePlanCourse,
  removeDegreePlanCourse,
};
