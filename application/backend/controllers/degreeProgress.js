const { pool } = require("../db");

const FAILING_GRADES = new Set(["F", "NP"]);
const GRADE_RANK = {
  F: 0, NP: 0, "D-": 1, D: 2, "D+": 3, "C-": 4,
  C: 5, P: 5, "C+": 6, "B-": 7, B: 8, "B+": 9,
  "A-": 10, A: 11,
};

function requireStudent(req, res) {
  if (req.auth.role !== "student") {
    res.status(403).json({ message: "Student access required." });
    return false;
  }
  return true;
}

function isPassingGrade(grade) {
  return Boolean(grade) && !FAILING_GRADES.has(String(grade).toUpperCase());
}

function meetsMinimumGrade(grade, minimumGrade) {
  if (!isPassingGrade(grade)) return false;
  if (!minimumGrade) return true;
  const actual = GRADE_RANK[String(grade).toUpperCase()];
  const required = GRADE_RANK[String(minimumGrade).toUpperCase()];
  return actual === undefined || required === undefined || actual >= required;
}

function courseRow(row, status) {
  return {
    courseId: row.course_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    units: Number(row.course_units || 0),
    grade: row.grade || null,
    status,
    geAreaIds: row.ge_area_ids || [],
  };
}

function uniqueCourses(rows, status) {
  const byCourse = new Map();
  for (const row of rows) {
    const course = courseRow(row, status);
    const existing = byCourse.get(course.courseId);
    if (!existing || (GRADE_RANK[course.grade] ?? -1) > (GRADE_RANK[existing.grade] ?? -1)) {
      byCourse.set(course.courseId, course);
    }
  }
  return [...byCourse.values()];
}

function matchesRequirement(requirement, course, poolIds) {
  // GE rules track the complete selected area, including courses categorized later.
  if (requirement.requirement_type === "ge-area" && requirement.ge_area_id) {
    return course.geAreaIds.includes(requirement.ge_area_id);
  }
  if (poolIds.size > 0) return poolIds.has(course.courseId);
  return false;
}

function sumUnits(courses) {
  return courses.reduce((sum, course) => sum + course.units, 0);
}

function cappedUnits(courses, requiredUnits) {
  return Math.min(sumUnits(courses), requiredUnits);
}

function isCartProjectionComplete(requirements, requiredMajorUnits, requiredGeUnits) {
  const projectedUnits = (types, limit) =>
    Math.min(
      requirements
        .filter((requirement) => types.includes(requirement.type))
        .reduce((sum, requirement) => sum + requirement.cartProjectedUnits, 0),
      limit
    );
  const requiredUnits = requiredMajorUnits + requiredGeUnits;
  const coveredUnits =
    projectedUnits(["major-core", "major-elective"], requiredMajorUnits) +
    projectedUnits(["ge-area", "university-requirement"], requiredGeUnits);

  return requirements.length > 0 &&
    coveredUnits === requiredUnits &&
    requirements.every((requirement) => requirement.cartProjectedComplete);
}

function prerequisiteRows(requiredCourses, prerequisiteByCourse, passedById) {
  return requiredCourses.map((course) => ({
    ...course,
    prerequisites: (prerequisiteByCourse.get(course.courseId) || []).map((item) => {
      const completed = passedById.get(item.courseId);
      return {
        ...item,
        satisfied: Boolean(completed && meetsMinimumGrade(completed.grade, item.minimumGrade)),
        completedGrade: completed?.grade || null,
      };
    }),
  }));
}

async function getDegreeProgress(req, res) {
  if (!requireStudent(req, res)) return;

  try {
    const studentResult = await pool.query(
      `SELECT s.student_id, s.degree_program_id, s.total_credits,
        dp.degree_type, dp.catalog_year, dp.required_major_units,
        dp.required_ge_units, m.major_name, d.department_name
       FROM public.student s
       LEFT JOIN public.degree_program dp ON dp.degree_program_id = s.degree_program_id
       LEFT JOIN public.major m ON m.major_id = dp.major_id
       LEFT JOIN public.department d ON d.department_id = m.department_id
       WHERE s.student_id = $1`,
      [req.auth.userId]
    );
    const student = studentResult.rows[0];
    if (!student) return res.status(404).json({ message: "Student profile not found." });
    if (!student.degree_program_id) {
      return res.json({ degreeProgram: null, summary: {
        requiredUnits: 0, completedUnits: 0, inProgressUnits: 0,
        plannedUnits: 0, remainingUnits: 0, percentComplete: 0,
      }, categorySummary: null, requirements: [] });
    }

    const [requirementResult, requiredCourseResult, completedResult,
      inProgressResult, plannedResult, prerequisiteResult] = await Promise.all([
      pool.query(
        `SELECT dr.degree_requirement_id, dr.requirement_name,
          dr.requirement_type, dr.completion_rule, dr.required_units,
          dr.minimum_grade, ga.ge_area_id, ga.ge_area_code, ga.ge_area_name
         FROM public.degree_requirement dr
         LEFT JOIN public.ge_area ga ON ga.ge_area_id = dr.ge_area_id
         WHERE dr.degree_program_id = $1
         ORDER BY CASE dr.requirement_type WHEN 'major-core' THEN 1
           WHEN 'major-elective' THEN 2 WHEN 'ge-area' THEN 3 ELSE 4 END,
           dr.degree_requirement_id`,
        [student.degree_program_id]
      ),
      pool.query(
        `SELECT rc.requirement_id, c.course_id, c.subject_code,
          c.course_number, c.course_title, c.course_units
         FROM public.required_course rc
         JOIN public.course c ON c.course_id = rc.course_id
         JOIN public.degree_requirement dr ON dr.degree_requirement_id = rc.requirement_id
         WHERE dr.degree_program_id = $1
         ORDER BY rc.requirement_id, c.subject_code, c.course_number`,
        [student.degree_program_id]
      ),
      pool.query(
        `SELECT c.course_id, c.subject_code, c.course_number, c.course_title,
          c.course_units, e.grade,
          ARRAY(SELECT cga.ge_area_id FROM public.course_ge_area cga
            WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_ids
         FROM public.enrollment e
         JOIN public.class_section cs ON cs.class_section_id = e.class_section_id
         JOIN public.course c ON c.course_id = cs.course_id
         WHERE e.student_id = $1 AND e.enrollment_status = 'completed'`,
        [req.auth.userId]
      ),
      pool.query(
        `SELECT DISTINCT c.course_id, c.subject_code, c.course_number,
          c.course_title, c.course_units, NULL AS grade,
          ARRAY(SELECT cga.ge_area_id FROM public.course_ge_area cga
            WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_ids
         FROM public.enrollment e
         JOIN public.class_section cs ON cs.class_section_id = e.class_section_id
         JOIN public.course c ON c.course_id = cs.course_id
         WHERE e.student_id = $1 AND e.enrollment_status = 'enrolled'`,
        [req.auth.userId]
      ),
      pool.query(
        `SELECT DISTINCT c.course_id, c.subject_code, c.course_number,
          c.course_title, c.course_units, NULL AS grade,
          ARRAY(SELECT cga.ge_area_id FROM public.course_ge_area cga
            WHERE cga.course_id = c.course_id ORDER BY cga.ge_area_id) AS ge_area_ids
         FROM public.course c
         WHERE c.course_id IN (
           SELECT cs.course_id FROM public.class_cart cc
           JOIN public.class_section cs ON cs.class_section_id = cc.class_section_id
           JOIN public.semester s ON s.semester_id = cs.semester_id
           WHERE cc.student_id = $1 AND s.is_active = TRUE
           )`,
        [req.auth.userId]
      ),
      pool.query(
        `SELECT cp.course_id, cp.prerequisite_course_id, cp.minimum_grade,
          c.subject_code, c.course_number, c.course_title, c.course_units
         FROM public.course_prerequisite cp
         JOIN public.course c ON c.course_id = cp.prerequisite_course_id
         WHERE cp.course_id IN (
           SELECT rc.course_id FROM public.required_course rc
           JOIN public.degree_requirement dr ON dr.degree_requirement_id = rc.requirement_id
           WHERE dr.degree_program_id = $1
         )`,
        [student.degree_program_id]
      ),
    ]);

    const requiredByRequirement = new Map();
    for (const row of requiredCourseResult.rows) {
      const list = requiredByRequirement.get(row.requirement_id) || [];
      list.push(courseRow(row, null));
      requiredByRequirement.set(row.requirement_id, list);
    }
    const prerequisiteByCourse = new Map();
    for (const row of prerequisiteResult.rows) {
      const list = prerequisiteByCourse.get(row.course_id) || [];
      list.push({ courseId: row.prerequisite_course_id, subjectCode: row.subject_code,
        courseNumber: row.course_number, title: row.course_title,
        units: Number(row.course_units || 0), minimumGrade: row.minimum_grade });
      prerequisiteByCourse.set(row.course_id, list);
    }

    const completedAll = uniqueCourses(completedResult.rows, "completed")
      .filter((course) => isPassingGrade(course.grade));
    const completedById = new Map(completedAll.map((course) => [course.courseId, course]));
    const inProgressAll = uniqueCourses(inProgressResult.rows, "in-progress")
      .filter((course) => !completedById.has(course.courseId));
    const activeIds = new Set([...completedById.keys(), ...inProgressAll.map((c) => c.courseId)]);
    const plannedAll = uniqueCourses(plannedResult.rows, "planned")
      .filter((course) => !activeIds.has(course.courseId));

    const requirements = requirementResult.rows.map((row) => {
      const requiredCourses = requiredByRequirement.get(row.degree_requirement_id) || [];
      const poolIds = new Set(requiredCourses.map((course) => course.courseId));
      const completed = completedAll.filter((course) =>
        matchesRequirement(row, course, poolIds) && meetsMinimumGrade(course.grade, row.minimum_grade));
      const inProgress = inProgressAll.filter((course) => matchesRequirement(row, course, poolIds));
      const planned = plannedAll.filter((course) => matchesRequirement(row, course, poolIds));
      const allCourseRule = row.completion_rule === "all-courses";
      // An all-courses requirement is defined by its complete course list. Use
      // the catalog units so a later course-unit change cannot leave the
      // requirement total out of sync with the courses students must take.
      const requiredUnits = allCourseRule
        ? sumUnits(requiredCourses)
        : Number(row.required_units || 0);
      const completedIds = new Set(completed.map((course) => course.courseId));
      const projectedIds = new Set([...completed, ...inProgress, ...planned].map((course) => course.courseId));
      const completedSatisfied = allCourseRule
        ? requiredCourses.length > 0 && requiredCourses.every((course) => completedIds.has(course.courseId)) && sumUnits(completed) >= requiredUnits
        : sumUnits(completed) >= requiredUnits;
      const projectedSatisfied = allCourseRule
        ? requiredCourses.length > 0 && requiredCourses.every((course) => projectedIds.has(course.courseId)) && sumUnits([...completed, ...inProgress, ...planned]) >= requiredUnits
        : sumUnits([...completed, ...inProgress, ...planned]) >= requiredUnits;
      const cartProjectedIds = new Set([...completed, ...planned].map((course) => course.courseId));
      const cartProjectedComplete = allCourseRule
        ? requiredCourses.length > 0 &&
          requiredCourses.every((course) => cartProjectedIds.has(course.courseId)) &&
          sumUnits([...completed, ...planned]) >= requiredUnits
        : sumUnits([...completed, ...planned]) >= requiredUnits;
      const completedUnits = cappedUnits(completed, requiredUnits);
      const inProgressUnits = Math.min(sumUnits(inProgress), Math.max(requiredUnits - completedUnits, 0));
      const plannedUnits = Math.min(sumUnits(planned), Math.max(requiredUnits - completedUnits - inProgressUnits, 0));
      const coursesWithPrerequisites = prerequisiteRows(requiredCourses, prerequisiteByCourse, completedById);

      return {
        requirementId: row.degree_requirement_id,
        name: row.requirement_name,
        type: row.requirement_type,
        completionRule: row.completion_rule,
        requiredUnits,
        completedUnits,
        inProgressUnits,
        plannedUnits,
        remainingUnits: Math.max(requiredUnits - completedUnits - inProgressUnits - plannedUnits, 0),
        status: completedSatisfied ? "completed" : projectedSatisfied ? "on-track" : "missing",
        cartProjectedComplete,
        cartProjectedUnits: cappedUnits([...completed, ...planned], requiredUnits),
        minimumGrade: row.minimum_grade,
        geArea: row.ge_area_id ? { geAreaId: row.ge_area_id, code: row.ge_area_code, name: row.ge_area_name } : null,
        requiredCourses: coursesWithPrerequisites,
        completedCourses: completed,
        inProgressCourses: inProgress,
        plannedCourses: planned,
        missingCourses: allCourseRule
          ? coursesWithPrerequisites.filter((course) => !projectedIds.has(course.courseId))
          : requiredCourses.filter((course) => !projectedIds.has(course.courseId)),
      };
    });

    const category = (types, requiredUnits) => {
      const items = requirements.filter((item) => types.includes(item.type));
      const completedUnits = Math.min(items.reduce((sum, item) => sum + item.completedUnits, 0), requiredUnits);
      const inProgressUnits = Math.min(items.reduce((sum, item) => sum + item.inProgressUnits, 0), Math.max(requiredUnits - completedUnits, 0));
      const plannedUnits = Math.min(items.reduce((sum, item) => sum + item.plannedUnits, 0), Math.max(requiredUnits - completedUnits - inProgressUnits, 0));
      return { requiredUnits, completedUnits, inProgressUnits, plannedUnits,
        remainingUnits: Math.max(requiredUnits - completedUnits - inProgressUnits - plannedUnits, 0),
        status: items.length > 0 && items.every((item) => item.status === "completed")
          ? "completed" : items.length > 0 && items.every((item) => item.status !== "missing") ? "on-track" : "missing" };
    };
    const major = category(["major-core", "major-elective"], Number(student.required_major_units || 0));
    const ge = category(["ge-area", "university-requirement"], Number(student.required_ge_units || 0));
    const requiredUnits = major.requiredUnits + ge.requiredUnits;
    const completedUnits = major.completedUnits + ge.completedUnits;
    const inProgressUnits = major.inProgressUnits + ge.inProgressUnits;
    const plannedUnits = major.plannedUnits + ge.plannedUnits;
    const remainingUnits = Math.max(
      requiredUnits - completedUnits - inProgressUnits - plannedUnits,
      0
    );
    const projectedComplete = isCartProjectionComplete(
      requirements,
      major.requiredUnits,
      ge.requiredUnits
    );

    return res.json({
      degreeProgram: { degreeProgramId: student.degree_program_id,
        degreeType: student.degree_type, catalogYear: student.catalog_year,
        majorName: student.major_name, departmentName: student.department_name },
      summary: { requiredUnits, completedUnits, inProgressUnits, plannedUnits,
        remainingUnits,
        percentComplete: requiredUnits ? Math.round((completedUnits / requiredUnits) * 100) : 0,
        projectedComplete },
      categorySummary: { major, ge },
      requirements,
    });
  } catch (error) {
    console.error("Unable to load degree progress:", error.message);
    return res.status(500).json({ message: "Unable to load degree progress." });
  }
}

module.exports = {
  getDegreeProgress,
  meetsMinimumGrade,
  uniqueCourses,
  isCartProjectionComplete,
};
