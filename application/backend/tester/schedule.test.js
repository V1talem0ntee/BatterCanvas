const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../db");
const { getCalendar } = require("../controllers/calendar");
const { listWalkingWarnings } = require("../controllers/walkingWarnings");

function studentRequest() {
  return { auth: { userId: 7, role: "student" } };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function sectionRow(overrides = {}) {
  return {
    calendar_status: "cart",
    course_id: 42,
    subject_code: "CSC",
    course_number: "648",
    course_title: "Software Engineering",
    course_units: 3,
    class_section_id: 100,
    semester_id: 8,
    section_number: "01",
    modality: "in-person",
    meeting_type: "synchronous",
    section_status: "open",
    meeting_start_time: "10:00:00",
    meeting_end_time: "11:30:00",
    instructor_first_name: "Jose",
    instructor_last_name: "Ortiz",
    building_id: 2,
    building_name: "Thornton Hall",
    map_element_id: "TH",
    room_number: "329",
    meeting_days: ["Monday"],
    ...overrides,
  };
}

test("calendar includes Cart and Enrolled sections but not planned courses", async (t) => {
  const originalQuery = pool.query;
  t.after(() => { pool.query = originalQuery; });

  pool.query = async (sql, values) => {
    assert.match(sql, /public\.class_cart/);
    assert.match(sql, /public\.enrollment/);
    assert.doesNotMatch(sql, /public\.planned_course/);
    assert.deepEqual(values, [7]);
    return {
      rows: [
        sectionRow(),
        sectionRow({
          calendar_status: "enrolled",
          course_id: 43,
          course_number: "675",
          class_section_id: 101,
          section_number: "02",
          meeting_start_time: "11:00:00",
          meeting_end_time: "12:15:00",
        }),
      ],
    };
  };

  const res = responseRecorder();
  await getCalendar(studentRequest(), res);

  const monday = res.body.calendar.find((day) => day.dayOfWeek === "Monday");
  assert.equal(monday.events.length, 2);
  assert.deepEqual(monday.events.map((event) => event.status), ["cart", "enrolled"]);
  assert.equal(res.body.conflicts.length, 1);
  assert.deepEqual(
    res.body.conflicts[0].sections.map((section) => section.classSectionId),
    [100, 101]
  );
});

test("walking warnings inspect Cart and Enrolled sections", async (t) => {
  const originalQuery = pool.query;
  t.after(() => { pool.query = originalQuery; });
  const queries = [];

  pool.query = async (sql, values) => {
    queries.push(sql);
    if (sql.includes("walking_speed_mps")) {
      assert.deepEqual(values, [7]);
      return { rows: [{ walking_speed_mps: 1.4 }] };
    }
    if (sql.includes("FROM public.building_distance")) return { rows: [] };
    return { rows: [] };
  };

  const res = responseRecorder();
  await listWalkingWarnings(studentRequest(), res);

  const sectionQuery = queries.find((sql) => sql.includes("selected.class_section_id"));
  assert.match(sectionQuery, /public\.class_cart/);
  assert.match(sectionQuery, /public\.enrollment/);
  assert.doesNotMatch(sectionQuery, /public\.planned_course/);
  assert.deepEqual(res.body, { warnings: [] });
});
