const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../db");
const {
  listNotifications,
  dismissNotification,
  dismissAllNotifications,
  buildConflictEvents,
} = require("../controllers/notifications");

function request(overrides = {}) {
  return {
    auth: { userId: 7, role: "student" },
    params: {},
    query: {},
    ...overrides,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test("listNotifications returns only the authenticated user's records", async (t) => {
  const originalQuery = pool.query;
  t.after(() => { pool.query = originalQuery; });

  pool.query = async (sql, values) => {
    assert.match(sql, /WHERE user_id = \$1/);
    assert.deepEqual(values, [7]);
    return {
      rows: [{
        notification_id: 10,
        notification_type: "deadline",
        title: "Deadline approaching",
        message: "Add/drop deadline is tomorrow.",
        created_at: "2026-07-18T18:00:00.000Z",
      }],
    };
  };

  const res = responseRecorder();
  await listNotifications(request(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, 1);
  assert.deepEqual(res.body.counts, { deadline: 1 });
  assert.equal(res.body.notifications[0].notificationId, 10);
});

test("dismissNotification validates the notification ID", async () => {
  const res = responseRecorder();
  await dismissNotification(request({ params: { notificationId: "bad" } }), res);
  assert.equal(res.statusCode, 400);
});

test("dismissNotification includes user ownership in the delete", async (t) => {
  const originalQuery = pool.query;
  t.after(() => { pool.query = originalQuery; });

  pool.query = async (sql, values) => {
    assert.match(sql, /AND user_id = \$2/);
    assert.deepEqual(values, [10, 7]);
    return { rows: [{ notification_id: 10 }] };
  };

  const res = responseRecorder();
  await dismissNotification(request({ params: { notificationId: "10" } }), res);
  assert.equal(res.statusCode, 204);
});

test("dismissAllNotifications returns the deleted record count", async (t) => {
  const originalQuery = pool.query;
  t.after(() => { pool.query = originalQuery; });

  pool.query = async (sql, values) => {
    assert.match(sql, /WHERE user_id = \$1/);
    assert.deepEqual(values, [7]);
    return { rowCount: 3, rows: [{}, {}, {}] };
  };

  const res = responseRecorder();
  await dismissAllNotifications(request(), res);
  assert.deepEqual(res.body, { dismissedCount: 3 });
});

test("notification sync identifies schedule and walking-time conflicts", () => {
  const sections = [
    {
      semester_id: 1, subject_code: "CSC", course_number: "101", section_number: "01",
      meeting_start_time: "09:00", meeting_end_time: "10:00", meeting_days: ["Monday"], building_id: 1,
    },
    {
      semester_id: 1, subject_code: "MATH", course_number: "226", section_number: "02",
      meeting_start_time: "09:30", meeting_end_time: "10:30", meeting_days: ["Monday"], building_id: 2,
    },
    {
      semester_id: 1, subject_code: "CSC", course_number: "220", section_number: "01",
      meeting_start_time: "10:35", meeting_end_time: "11:35", meeting_days: ["Monday"], building_id: 3,
    },
  ];
  const distances = [
    { origin_building_id: 2, destination_building_id: 3, distance_meters: 840 },
  ];

  const events = buildConflictEvents(sections, 1.4, distances);
  assert.equal(events.filter((event) => event.notification_type === "schedule-conflict").length, 1);
  assert.equal(events.filter((event) => event.notification_type === "walking-time-conflict").length, 1);
});
