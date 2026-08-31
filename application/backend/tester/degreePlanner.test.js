const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../db");
const {
  addYeartoDegreeplanner,
  addDegreePlanTerm,
  removeDegreePlanTerm,
  saveDegreePlanCourse,
  removeDegreePlanCourse,
} = require("../controllers/degreePlanner");

function studentRequest(overrides = {}) {
  return {
    auth: { userId: 7, role: "student" },
    body: {},
    params: {},
    ...overrides,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("addDegreePlanTerm persists a term in the existing student plan table", async (t) => {
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  pool.query = async (sql, values) => {
    assert.match(sql, /INSERT INTO public\.student_plan_term/);
    assert.doesNotMatch(sql, /student_degree_plan_term/);
    assert.deepEqual(values, [7, 2, "Winter", 2]);
    return {
      rows: [{
        plan_term_id: 12,
        term_year: 2,
        term_type: "Winter",
        display_order: 2,
      }],
    };
  };

  const res = responseRecorder();
  await addDegreePlanTerm(
    studentRequest({ body: { yearNumber: 2, termName: "Winter" } }),
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.term, {
    planTermId: 12,
    yearNumber: 2,
    termName: "Winter",
    termOrder: 2,
    courses: [],
  });
});

test("addYeartoDegreeplanner creates Fall and Spring in one transaction", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  const calls = [];
  let insertCount = 0;

  pool.connect = async () => ({
    async query(sql, values) {
      calls.push(sql);

      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      insertCount += 1;
      const termName = insertCount === 1 ? "Fall" : "Spring";
      assert.deepEqual(values, [
        7,
        5,
        termName,
        termName === "Fall" ? 1 : 3,
      ]);

      return {
        rows: [{
          plan_term_id: insertCount === 1 ? 20 : 21,
          term_year: 5,
          term_type: termName,
          display_order: termName === "Fall" ? 1 : 3,
        }],
      };
    },
    release() {},
  });

  const res = responseRecorder();
  await addYeartoDegreeplanner(
    studentRequest({ body: { year: 5 } }),
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.year.terms.length, 2);
  assert.equal(calls[0], "BEGIN");
  assert.equal(calls.at(-1), "COMMIT");
});

test("addYeartoDegreeplanner rolls back when Spring fails", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  const calls = [];
  let insertCount = 0;

  pool.connect = async () => ({
    async query(sql) {
      calls.push(sql);

      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      insertCount += 1;
      if (insertCount === 2) {
        throw new Error("Spring insert failed");
      }

      return {
        rows: [{
          plan_term_id: 20,
          term_year: 5,
          term_type: "Fall",
          display_order: 1,
        }],
      };
    },
    release() {},
  });

  const res = responseRecorder();
  await addYeartoDegreeplanner(
    studentRequest({ body: { year: 5 } }),
    res
  );

  assert.equal(res.statusCode, 500);
  assert.ok(calls.includes("ROLLBACK"));
  assert.ok(!calls.includes("COMMIT"));
});

test("saveDegreePlanCourse inserts a new item and commits atomically", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  const calls = [];
  pool.connect = async () => ({
    async query(sql, values) {
      calls.push({ sql, values });

      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (sql.includes("FROM public.course")) {
        return { rows: [{ course_id: 42 }] };
      }
      if (sql.includes("INSERT INTO public.student_plan_term")) {
        return { rows: [{ plan_term_id: 9 }] };
      }
      if (sql.includes("SELECT pi.plan_item_id")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO public.student_plan_item")) {
        assert.deepEqual(values, [9, 42]);
        return {
          rows: [{
            plan_item_id: 31,
            plan_term_id: 9,
            selected_course_id: 42,
          }],
        };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    release() {},
  });

  const res = responseRecorder();
  await saveDegreePlanCourse(
    studentRequest({
      body: {
        courseId: 42,
        yearNumber: 3,
        termName: "Spring",
        courseOrder: 1,
      },
    }),
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.plannedCourse, {
    planCourseId: 31,
    planTermId: 9,
    courseId: 42,
    courseOrder: 1,
  });
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("saveDegreePlanCourse moves an existing item instead of duplicating it", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  pool.connect = async () => ({
    async query(sql, values) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (sql.includes("FROM public.course")) {
        return { rows: [{ course_id: 42 }] };
      }
      if (sql.includes("INSERT INTO public.student_plan_term")) {
        return { rows: [{ plan_term_id: 10 }] };
      }
      if (sql.includes("SELECT pi.plan_item_id")) {
        assert.deepEqual(values, [7, 42]);
        return { rows: [{ plan_item_id: 31 }] };
      }
      if (sql.includes("UPDATE public.student_plan_item")) {
        assert.deepEqual(values, [10, 31]);
        return {
          rows: [{
            plan_item_id: 31,
            plan_term_id: 10,
            selected_course_id: 42,
          }],
        };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    release() {},
  });

  const res = responseRecorder();
  await saveDegreePlanCourse(
    studentRequest({
      body: { courseId: 42, yearNumber: 4, termName: "Fall" },
    }),
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.plannedCourse.planCourseId, 31);
  assert.equal(res.body.plannedCourse.planTermId, 10);
});

test("degree plan deletes are restricted to the authenticated student", async (t) => {
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ plan_term_id: 9, plan_item_id: 31 }] };
  };

  const termResponse = responseRecorder();
  await removeDegreePlanTerm(
    studentRequest({ params: { planTermId: "9" } }),
    termResponse
  );

  const courseResponse = responseRecorder();
  await removeDegreePlanCourse(
    studentRequest({ params: { courseId: "42" } }),
    courseResponse
  );

  assert.match(calls[0].sql, /DELETE FROM public\.student_plan_term/);
  assert.deepEqual(calls[0].values, [9, 7]);
  assert.match(calls[1].sql, /USING public\.student_plan_term/);
  assert.deepEqual(calls[1].values, [7, 42]);
  assert.equal(termResponse.statusCode, 200);
  assert.equal(courseResponse.statusCode, 200);
});
