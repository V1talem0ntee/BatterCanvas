const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../db");
const adminData = require("../controllers/adminData");
const management = require("../controllers/adminManagement");

function request(overrides = {}) {
  return { auth: { userId: 1, role: "admin" }, body: {}, params: {}, query: {}, ...overrides };
}

function responseRecorder() {
  // Minimal Express response double avoids a running HTTP server in unit tests.
  return {
    statusCode: 200, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test("admin dashboard maps database counts", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async (sql) => {
    assert.match(sql, /pending_invitations/);
    return { rows: [{ active_students: 8, total_courses: 12, total_sections: 20, pending_invitations: 2, open_sections: 10, waitlist_sections: 4, closed_sections: 5, cancelled_sections: 1 }] };
  };
  const res = responseRecorder();
  await adminData.getDashboard(request(), res);
  assert.equal(res.body.statistics.activeStudents, 8);
  assert.deepEqual(res.body.statistics.sectionsByStatus, { open: 10, waitlist: 4, closed: 5, cancelled: 1 });
});

test("student list validates degree program filter", async () => {
  const res = responseRecorder();
  await adminData.listStudents(request({ query: { degreeProgramId: "bad" } }), res);
  assert.equal(res.statusCode, 400);
});

test("student detail returns 404 when missing", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async () => ({ rows: [] });
  const res = responseRecorder();
  await adminData.getStudent(request({ params: { studentId: "7" } }), res);
  assert.equal(res.statusCode, 404);
});

test("course creation parses string false without coercing it to true", async (t) => {
  const original = pool.connect;
  t.after(() => { pool.connect = original; });
  pool.connect = async () => ({
    async query(sql, values) {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("INSERT INTO public.course")) { assert.equal(values[7], false); return { rows: [{ course_id: 42 }] }; }
      if (sql.includes("DELETE FROM public.course_ge_area")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  });
  const res = responseRecorder();
  await management.createCourse(request({ body: { departmentId: 1, subjectCode: "CSC", courseNumber: "648", title: "Software Engineering", description: "Description", units: 3, level: "upper_division", repeatable: "false", sectionType: "lecture", category: "major-core" } }), res);
  assert.equal(res.statusCode, 201);
});

test("course creation rejects an invalid boolean", async () => {
  const res = responseRecorder();
  await management.createCourse(request({ body: { departmentId: 1, subjectCode: "CSC", courseNumber: "648", title: "Software Engineering", description: "Description", units: 3, level: "upper_division", repeatable: "no", sectionType: "lecture" } }), res);
  assert.equal(res.statusCode, 400);
});

test("course deletion removes planning and catalog associations first", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  const calls = [];
  let released = false;
  pool.connect = async () => ({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (sql.includes("AS has_sections")) {
        return { rows: [{ course_id: 42, has_sections: false }] };
      }
      return { rows: [] };
    },
    release() {
      released = true;
    },
  });

  const res = responseRecorder();
  await management.deleteCourse(
    request({ params: { courseId: "42" } }),
    res
  );

  assert.equal(res.statusCode, 204);
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[2].sql, /DELETE FROM public\.student_plan_item/);
  assert.match(calls[3].sql, /DELETE FROM public\.degree_roadmap_item/);
  assert.match(calls[4].sql, /DELETE FROM public\.planned_course/);
  assert.match(calls[5].sql, /DELETE FROM public\.required_course/);
  assert.match(calls[6].sql, /DELETE FROM public\.course_prerequisite/);
  assert.match(calls[7].sql, /DELETE FROM public\.course_ge_area/);
  assert.match(calls[8].sql, /DELETE FROM public\.course/);
  assert.equal(calls[9].sql, "COMMIT");
  assert.equal(released, true);
});

test("course deletion keeps a course that still has class sections", async (t) => {
  const originalConnect = pool.connect;
  t.after(() => {
    pool.connect = originalConnect;
  });

  const calls = [];
  pool.connect = async () => ({
    async query(sql) {
      calls.push(sql);
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("AS has_sections")) {
        return { rows: [{ course_id: 42, has_sections: true }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  });

  const res = responseRecorder();
  await management.deleteCourse(
    request({ params: { courseId: "42" } }),
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /class sections/);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("requirement course association is idempotent", async (t) => {
  // Repeating the association succeeds without inserting a duplicate row.
  const original = pool.connect;
  t.after(() => { pool.connect = original; });
  pool.connect = async () => ({
    async query(sql, values) {
      if (["BEGIN", "COMMIT"].includes(sql)) return { rows: [] };
      if (sql.includes("FOR UPDATE OF dp")) return { rows: [{ degree_program_id: 8 }] };
      if (sql.includes("dr.degree_requirement_id <>")) return { rows: [] };
      assert.match(sql, /ON CONFLICT DO NOTHING/);
      assert.deepEqual(values, [3, 42]);
      return { rows: [] };
    },
    release() {},
  });
  const res = responseRecorder();
  await adminData.addRequirementCourse(request({ params: { degreeRequirementId: "3", courseId: "42" } }), res);
  assert.equal(res.statusCode, 200);
});

test("course list applies its subject filter without throwing", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async (sql, values) => {
    assert.match(sql, /LOWER\(c\.subject_code\) = \$1/);
    assert.equal(values[0], "csc");
    if (sql.includes("COUNT(*)")) return { rows: [{ total: 0 }] };
    return { rows: [] };
  };
  const res = responseRecorder();
  await adminData.listCourses(request({ query: { subjectCode: "CSC", page: "1", pageSize: "10" } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.courses, []);
});

test("admin can bulk import a major elective course", async (t) => {
  const original = pool.connect;
  t.after(() => { pool.connect = original; });
  pool.connect = async () => ({
    async query(sql, values) {
      if (["BEGIN", "COMMIT"].includes(sql)) return { rows: [] };
      if (sql.includes("SELECT department_id")) return { rows: [{ department_id: 4, department_name: "Computer Science" }] };
      if (sql.includes("SELECT ge_area_id")) return { rows: [] };
      if (sql.includes("INSERT INTO public.course")) {
        assert.equal(values[9], "major-elective");
        return { rows: [{ course_id: 42 }] };
      }
      if (sql.includes("DELETE FROM public.course_ge_area")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  });
  const res = responseRecorder();
  await management.bulkImportCourses(request({ body: { courses: [{
    department: "Computer Science", subjectCode: "CSC", courseNumber: "413",
    title: "Software Development", description: "Software development course",
    units: "3", level: "upper_division", category: "major-elective", geArea: "",
    sectionType: "lecture", repeatable: "false",
  }] } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.imported, 1);
});

test("course cannot be assigned to two requirements in one degree program", async (t) => {
  const original = pool.connect;
  t.after(() => { pool.connect = original; });
  pool.connect = async () => ({
    async query(sql) {
      if (["BEGIN", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("FOR UPDATE OF dp")) return { rows: [{ degree_program_id: 8 }] };
      if (sql.includes("dr.degree_requirement_id <>")) return { rows: [{ requirement_name: "Major Core" }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  });
  const res = responseRecorder();
  await adminData.addRequirementCourse(request({ params: { degreeRequirementId: "4", courseId: "42" } }), res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /Major Core/);
});

test("admin can record a completed course grade for a student", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async (sql, values) => {
    assert.match(sql, /ON CONFLICT \(student_id, class_section_id\)/);
    assert.match(sql, /enrollment_status = 'completed'/);
    assert.deepEqual(values.slice(0, 2), [7, 42]);
    assert.equal(values[3], "B+");
    return { rows: [{ student_id: 7, class_section_id: 42, grade: "B+" }] };
  };
  const res = responseRecorder();
  await management.setStudentCourseResult(request({
    params: { studentId: "7", classSectionId: "42" },
    body: { grade: "B+", enrollmentDate: "2026-07-21" },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.passed, true);
});

test("department creation validates all contact and location fields", async () => {
  const res = responseRecorder();
  await management.createDepartment(request({ body: { schoolId: 1, name: "Computer Science" } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /buildingId/);
});

test("major creation maps its department and name", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  pool.query = async (sql, values) => {
    assert.match(sql, /public\.major/);
    assert.deepEqual(values, [4, "Computer Science"]);
    return { rows: [{ major_id: 9 }] };
  };
  const res = responseRecorder();
  await management.createMajor(request({ body: { departmentId: 4, name: "Computer Science" } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.majorId, 9);
});

test("admin can generate sequential classrooms for a floor", async (t) => {
  const original = pool.connect;
  t.after(() => { pool.connect = original; });
  const calls = [];
  pool.connect = async () => ({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("FROM public.building")) return { rows: [{ building_id: 5 }] };
      if (sql.includes("INSERT INTO public.classroom")) {
        assert.deepEqual(values, [5, ["101", "102", "103"]]);
        return { rows: [
          { classroom_id: 1, room_number: "101" },
          { classroom_id: 2, room_number: "102" },
          { classroom_id: 3, room_number: "103" },
        ] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  });
  const res = responseRecorder();
  await management.createClassroomsForFloor(request({
    params: { buildingId: "5" },
    body: { floor: 1, roomCount: 3 },
  }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.createdCount, 3);
  assert.equal(res.body.skippedCount, 0);
  assert.equal(calls.length, 4);
});

test("admin can drop an enrolled student and decrement the section count", async (t) => {
  const original = pool.connect;
  t.after(() => { pool.connect = original; });
  let countUpdated = false;
  pool.connect = async () => ({
    async query(sql, values) {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("FROM public.enrollment")) {
        assert.deepEqual(values, [7, 42]);
        return { rows: [{ enrollment_status: "enrolled", grade: null }] };
      }
      if (sql.includes("DELETE FROM public.class_cart")) return { rows: [] };
      if (sql.includes("UPDATE public.enrollment")) return { rows: [] };
      if (sql.includes("UPDATE public.class_section")) {
        assert.deepEqual(values, [42]);
        countUpdated = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  });
  const res = responseRecorder();
  await management.dropStudentFromSection(request({
    params: { studentId: "7", classSectionId: "42" },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.enrollmentStatus, "dropped");
  assert.equal(countUpdated, true);
});

test("admin can delete an inactive unreferenced semester", async (t) => {
  const original = pool.query;
  t.after(() => { pool.query = original; });
  let deleted = false;
  pool.query = async (sql, values) => {
    assert.deepEqual(values, [8]);
    if (sql.includes("SELECT is_active")) return { rows: [{ is_active: false }] };
    if (sql.includes("DELETE FROM public.semester")) { deleted = true; return { rows: [] }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const res = responseRecorder();
  await management.deleteSemester(request({ params: { semesterId: "8" } }), res);
  assert.equal(res.statusCode, 204);
  assert.equal(deleted, true);
});
