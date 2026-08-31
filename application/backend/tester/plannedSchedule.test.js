const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../db");
const {
  listPlannedCourses,
  addPlannedCourse,
  removePlannedCourse,
} = require("../controllers/plannedSchedule");

function studentRequest(overrides = {}) {
  return {
    auth: { userId: 7, role: "student" },
    body: {},
    params: {},
    ...overrides,
  };
}

// Minimal Express response replacement used to test controllers without
// starting the server or connecting to the shared development database.
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
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test("listPlannedCourses returns the documented plannedCourses response", async (t) => {
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  pool.query = async (sql, values) => {
    assert.match(sql, /FROM public\.planned_course/);
    assert.deepEqual(values, [7]);
    return {
      rows: [
        {
          course_id: 42,
          subject_code: "CSC",
          course_number: "648",
          course_title: "Software Engineering",
          course_description: "Software development processes.",
          course_units: 3,
          semester_id: 8,
          term_year: 2026,
          term_type: "Fall",
          added_date: "2026-07-18T18:00:00.000Z",
        },
      ],
    };
  };

  const res = responseRecorder();
  await listPlannedCourses(studentRequest(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    plannedCourses: [
      {
        courseId: 42,
        subjectCode: "CSC",
        courseNumber: "648",
        title: "Software Engineering",
        description: "Software development processes.",
        units: 3,
        semesterId: 8,
        termYear: 2026,
        termType: "Fall",
        addedDate: "2026-07-18T18:00:00.000Z",
      },
    ],
  });
});

test("addPlannedCourse rejects invalid course and semester IDs", async () => {
  const res = responseRecorder();

  await addPlannedCourse(
    studentRequest({ body: { courseId: "invalid", semesterId: 0 } }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /courseId and semesterId/);
});

test("addPlannedCourse does not create a duplicate plan record", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  const calls = [];
  pool.connect = async () => ({
    async query(sql, values) {
      calls.push({ sql, values });

      if (sql.includes("AS course_exists")) {
        return { rows: [{ course_exists: true, semester_exists: true }] };
      }

      if (sql.includes("SELECT is_active FROM public.semester")) {
        return { rows: [{ is_active: true }] };
      }

      if (sql.includes("INSERT INTO public.planned_course")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    release() {},
  });

  const res = responseRecorder();
  await addPlannedCourse(
    studentRequest({ body: { courseId: 42, semesterId: 8 } }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /already in the study plan/);
  assert.deepEqual(res.body.plannedCourse, { courseId: 42, semesterId: 8 });
  assert.equal(calls.length, 3);
});

test("removePlannedCourse deletes only the authenticated student's record", async (t) => {
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  pool.query = async (sql, values) => {
    if (sql.includes("SELECT is_active FROM public.semester")) {
      assert.deepEqual(values, [8]);
      return { rows: [{ is_active: true }] };
    }
    assert.match(sql, /DELETE FROM public\.planned_course/);
    assert.deepEqual(values, [7, 42, 8]);
    return { rows: [{ student_id: 7 }] };
  };

  const res = responseRecorder();
  await removePlannedCourse(
    studentRequest({ params: { courseId: "42", semesterId: "8" } }),
    res
  );

  assert.equal(res.statusCode, 204);
  assert.equal(res.body, undefined);
});
