const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../db");
const {
  getDegreeProgress,
  meetsMinimumGrade,
  uniqueCourses,
  isCartProjectionComplete,
} = require("../controllers/degreeProgress");

function responseRecorder() {
  return { statusCode: 200, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

const course = (id, number, grade = null, units = 3) => ({ course_id: id, subject_code: "CSC",
  course_number: number, course_title: `Course ${number}`, course_units: units,
  grade, ge_area_ids: [] });

test("grade checks reject failed prerequisites and honor minimum grade", () => {
  assert.equal(meetsMinimumGrade("F", null), false);
  assert.equal(meetsMinimumGrade("C-", "C"), false);
  assert.equal(meetsMinimumGrade("B", "C"), true);
});

test("completed retakes count once and keep the highest grade", () => {
  const rows = uniqueCourses([course(1, "101", "C"), course(1, "101", "A")], "completed");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].grade, "A");
});

test("degree progress requires every core course and uses cart courses as planned", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async (sql) => {
    if (sql.includes("FROM public.student s")) return { rows: [{ student_id: 7,
      degree_program_id: 2, degree_type: "BS", catalog_year: 2026,
      required_major_units: 10, required_ge_units: 0,
      major_name: "Computer Science", department_name: "Computer Science" }] };
    if (sql.includes("FROM public.degree_requirement dr") && sql.includes("completion_rule")) return { rows: [
      { degree_requirement_id: 10, requirement_name: "Core", requirement_type: "major-core",
        completion_rule: "all-courses", required_units: 6, minimum_grade: "C", ge_area_id: null },
      { degree_requirement_id: 11, requirement_name: "Electives", requirement_type: "major-elective",
        completion_rule: "minimum-units", required_units: 3, minimum_grade: null, ge_area_id: null },
    ] };
    if (sql.includes("FROM public.required_course rc")) return { rows: [
      { requirement_id: 10, ...course(1, "101", null, 4) },
      { requirement_id: 10, ...course(2, "210") },
      { requirement_id: 11, ...course(3, "510") },
      { requirement_id: 11, ...course(4, "520") },
    ] };
    if (sql.includes("e.enrollment_status = 'completed'")) {
      return { rows: [course(1, "101", "B", 4), course(1, "101", "A", 4)] };
    }
    if (sql.includes("e.enrollment_status = 'enrolled'")) return { rows: [] };
    if (sql.includes("FROM public.class_cart cc")) {
      assert.doesNotMatch(sql, /student_plan_item/);
      assert.match(sql, /s\.is_active = TRUE/);
      return { rows: [course(2, "210"), course(3, "510")] };
    }
    if (sql.includes("FROM public.course_prerequisite cp")) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  };

  const res = responseRecorder();
  await getDegreeProgress({ auth: { userId: 7, role: "student" } }, res);
  assert.equal(res.statusCode, 200);
  const core = res.body.requirements[0];
  const electives = res.body.requirements[1];
  assert.equal(core.requiredUnits, 7);
  assert.equal(core.completedUnits, 4);
  assert.equal(core.plannedUnits, 3);
  assert.equal(core.status, "on-track");
  assert.equal(electives.status, "on-track");
  assert.equal(res.body.summary.plannedUnits, 6);
  assert.equal(res.body.summary.remainingUnits, 0);
  assert.equal(res.body.summary.projectedComplete, true);
});

test("graduation readiness requires cart coverage of every program unit", () => {
  const requirements = [
    { type: "major-core", cartProjectedUnits: 6, cartProjectedComplete: true },
  ];
  assert.equal(isCartProjectionComplete(requirements, 9, 0), false);
  assert.equal(isCartProjectionComplete(requirements, 6, 0), true);
  assert.equal(
    isCartProjectionComplete(
      [{ ...requirements[0], cartProjectedComplete: false }],
      6,
      0
    ),
    false
  );
});
