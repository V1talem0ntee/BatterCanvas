const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../db");
const { listCourses } = require("../controllers/courses");

function responseRecorder() {
  return { statusCode: 200, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

test("course search normalizes division filters and accepts major electives", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async (sql, values) => {
    assert.match(sql, /c\.course_category = 'major-elective'/);
    assert.ok(values.includes("lower_division"));
    return { rows: [] };
  };
  const res = responseRecorder();
  await listCourses({ query: { semesterId: "5", level: "lower-division", courseCategory: "major-elective" } }, res);
  assert.equal(res.statusCode, 200);
});
