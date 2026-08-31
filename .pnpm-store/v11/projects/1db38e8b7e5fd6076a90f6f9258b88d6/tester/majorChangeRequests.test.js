const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../db");
const {
  createMajorChangeRequest,
  reviewMajorChangeRequest,
} = require("../controllers/majorChangeRequests");

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test("student cannot request their existing degree program", async (t) => {
  const originalQuery = pool.query;
  t.after(() => { pool.query = originalQuery; });
  pool.query = async (sql, values) => {
    assert.match(sql, /IS DISTINCT FROM/);
    assert.deepEqual(values, [6, 3, null]);
    return { rows: [] };
  };
  const res = responseRecorder();
  await createMajorChangeRequest({ auth: { userId: 6, role: "student" }, body: { degreeProgramId: 3 } }, res);
  assert.equal(res.statusCode, 400);
});

test("approving a major request changes the program and records the review", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => { pool.connect = originalConnect; });
  const statements = [];
  const client = {
    async query(sql, values) {
      statements.push({ sql, values });
      if (sql.includes("FOR UPDATE")) {
        assert.deepEqual(values, [11, 2]);
        return { rows: [{ student_id: 6, requested_degree_program_id: 9 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  pool.connect = async () => client;
  const res = responseRecorder();
  await reviewMajorChangeRequest({
    auth: { userId: 2, role: "admin" },
    params: { requestId: "11" },
    body: { decision: "approved", reviewNote: "Approved by advising." },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(statements.some(({ sql, values }) =>
    sql.includes("UPDATE public.student SET degree_program_id") && values[0] === 9 && values[1] === 6));
  assert.ok(statements.some(({ sql, values }) =>
    sql.includes("UPDATE public.major_change_request") && values[0] === "approved"));
  assert.ok(statements.some(({ sql }) => sql.includes("INSERT INTO public.notification")));
  assert.equal(statements.at(-1).sql, "COMMIT");
});
