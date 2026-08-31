const { pool } = require("../db");

function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function programLabel(prefix) {
  return `json_build_object(
    'degreeProgramId', ${prefix}.degree_program_id,
    'majorName', ${prefix}_major.major_name,
    'degreeType', ${prefix}.degree_type,
    'catalogYear', ${prefix}.catalog_year
  )`;
}

const REQUEST_SELECT = `
  SELECT
    r.major_change_request_id, r.student_id, r.request_reason,
    r.request_status, r.submitted_at, r.reviewed_at, r.review_note,
    u.first_name, u.last_name, s.school_student_id,
    ${programLabel("current_program")} AS current_program,
    ${programLabel("requested_program")} AS requested_program,
    reviewer.first_name AS reviewer_first_name,
    reviewer.last_name AS reviewer_last_name
  FROM public.major_change_request r
  JOIN public.student s ON s.student_id = r.student_id
  JOIN public.app_user u ON u.user_id = r.student_id
  LEFT JOIN public.degree_program current_program
    ON current_program.degree_program_id = r.current_degree_program_id
  LEFT JOIN public.major current_program_major
    ON current_program_major.major_id = current_program.major_id
  JOIN public.degree_program requested_program
    ON requested_program.degree_program_id = r.requested_degree_program_id
  JOIN public.major requested_program_major
    ON requested_program_major.major_id = requested_program.major_id
  LEFT JOIN public.app_user reviewer ON reviewer.user_id = r.reviewed_by`;

function requestRow(row) {
  return {
    requestId: row.major_change_request_id,
    studentId: row.student_id,
    studentName: `${row.first_name} ${row.last_name}`,
    schoolStudentId: row.school_student_id,
    reason: row.request_reason,
    status: row.request_status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    currentProgram: row.current_program?.degreeProgramId ? row.current_program : null,
    requestedProgram: row.requested_program,
    reviewer: row.reviewer_first_name
      ? `${row.reviewer_first_name} ${row.reviewer_last_name}`
      : null,
  };
}

async function listStudentMajorChangeData(req, res) {
  if (req.auth.role !== "student") {
    return res.status(403).json({ message: "Student access required." });
  }
  try {
    const programs = await pool.query(
      `SELECT dp.degree_program_id, m.major_name, dp.degree_type, dp.catalog_year
       FROM public.student s
       JOIN public.app_user u ON u.user_id = s.student_id
       JOIN public.degree_program dp ON TRUE
       JOIN public.major m ON m.major_id = dp.major_id
       JOIN public.department d ON d.department_id = m.department_id
       WHERE s.student_id = $1 AND d.school_id = u.school_id
       ORDER BY m.major_name, dp.degree_type, dp.catalog_year DESC`,
      [req.auth.userId]
    );
    const requests = await pool.query(
      `${REQUEST_SELECT}
       WHERE r.student_id = $1
       ORDER BY r.submitted_at DESC, r.major_change_request_id DESC`,
      [req.auth.userId]
    );
    return res.json({
      programs: programs.rows.map((row) => ({
        degreeProgramId: row.degree_program_id,
        majorName: row.major_name,
        degreeType: row.degree_type,
        catalogYear: row.catalog_year,
      })),
      requests: requests.rows.map(requestRow),
    });
  } catch (error) {
    console.error("Unable to load major change requests:", error.message);
    return res.status(500).json({ message: "Unable to load major change requests." });
  }
}

async function createMajorChangeRequest(req, res) {
  if (req.auth.role !== "student") {
    return res.status(403).json({ message: "Student access required." });
  }
  const requestedProgramId = cleanId(req.body?.degreeProgramId);
  const reason = String(req.body?.reason || "").trim() || null;
  if (!requestedProgramId) {
    return res.status(400).json({ message: "A valid degreeProgramId is required." });
  }
  if (reason && reason.length > 1000) {
    return res.status(400).json({ message: "Reason must be 1000 characters or fewer." });
  }
  try {
    const created = await pool.query(
      `INSERT INTO public.major_change_request
       (student_id, current_degree_program_id, requested_degree_program_id, request_reason)
       SELECT s.student_id, s.degree_program_id, dp.degree_program_id, $3
       FROM public.student s
       JOIN public.app_user u ON u.user_id = s.student_id
       JOIN public.degree_program dp ON dp.degree_program_id = $2
       JOIN public.major m ON m.major_id = dp.major_id
       JOIN public.department d ON d.department_id = m.department_id
       WHERE s.student_id = $1
         AND d.school_id = u.school_id
         AND s.degree_program_id IS DISTINCT FROM dp.degree_program_id
       RETURNING major_change_request_id`,
      [req.auth.userId, requestedProgramId, reason]
    );
    if (!created.rows.length) {
      return res.status(400).json({ message: "Select a different valid degree program." });
    }
    return res.status(201).json({
      message: "Major change request submitted for administrator review.",
      requestId: created.rows[0].major_change_request_id,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "You already have a pending major change request." });
    }
    console.error("Unable to submit major change request:", error.message);
    return res.status(500).json({ message: "Unable to submit major change request." });
  }
}

async function withdrawMajorChangeRequest(req, res) {
  if (req.auth.role !== "student") {
    return res.status(403).json({ message: "Student access required." });
  }
  const requestId = cleanId(req.params.requestId);
  if (!requestId) return res.status(400).json({ message: "A valid requestId is required." });
  try {
    const result = await pool.query(
      `UPDATE public.major_change_request
       SET request_status = 'withdrawn'
       WHERE major_change_request_id = $1 AND student_id = $2 AND request_status = 'pending'
       RETURNING major_change_request_id`,
      [requestId, req.auth.userId]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Pending request not found." });
    return res.status(204).send();
  } catch (error) {
    console.error("Unable to withdraw major change request:", error.message);
    return res.status(500).json({ message: "Unable to withdraw major change request." });
  }
}

async function listAdminMajorChangeRequests(req, res) {
  const status = String(req.query.status || "pending").toLowerCase();
  if (!new Set(["all", "pending", "approved", "denied", "withdrawn"]).has(status)) {
    return res.status(400).json({ message: "Invalid request status." });
  }
  try {
    const values = [req.auth.userId];
    const where = status === "all"
      ? "WHERE u.school_id = (SELECT school_id FROM public.app_user WHERE user_id = $1)"
      : "WHERE u.school_id = (SELECT school_id FROM public.app_user WHERE user_id = $1) AND r.request_status = $2";
    if (status !== "all") values.push(status);
    const result = await pool.query(
      `${REQUEST_SELECT} ${where}
       ORDER BY CASE WHEN r.request_status = 'pending' THEN 0 ELSE 1 END,
         r.submitted_at DESC`,
      values
    );
    return res.json({ requests: result.rows.map(requestRow) });
  } catch (error) {
    console.error("Unable to load admin major change requests:", error.message);
    return res.status(500).json({ message: "Unable to load major change requests." });
  }
}

async function reviewMajorChangeRequest(req, res) {
  const requestId = cleanId(req.params.requestId);
  const decision = String(req.body?.decision || "").toLowerCase();
  const reviewNote = String(req.body?.reviewNote || "").trim() || null;
  if (!requestId || !new Set(["approved", "denied"]).has(decision)) {
    return res.status(400).json({ message: "A valid requestId and approved/denied decision are required." });
  }
  if (reviewNote && reviewNote.length > 1000) {
    return res.status(400).json({ message: "Review note must be 1000 characters or fewer." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const request = await client.query(
      `SELECT r.student_id, r.requested_degree_program_id
       FROM public.major_change_request r
       JOIN public.app_user student_user ON student_user.user_id = r.student_id
       WHERE r.major_change_request_id = $1
         AND r.request_status = 'pending'
         AND student_user.school_id = (
           SELECT school_id FROM public.app_user WHERE user_id = $2
         )
       FOR UPDATE`,
      [requestId, req.auth.userId]
    );
    if (!request.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "This request is no longer pending." });
    }
    const item = request.rows[0];
    if (decision === "approved") {
      await client.query(
        `UPDATE public.student SET degree_program_id = $1 WHERE student_id = $2`,
        [item.requested_degree_program_id, item.student_id]
      );
    }
    await client.query(
      `UPDATE public.major_change_request
       SET request_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_note = $3
       WHERE major_change_request_id = $4`,
      [decision, req.auth.userId, reviewNote, requestId]
    );
    await client.query(
      `INSERT INTO public.notification (user_id, notification_type, title, message)
       VALUES ($1, 'general', $2, $3)`,
      [
        item.student_id,
        decision === "approved" ? "Major change approved" : "Major change request denied",
        decision === "approved"
          ? "Your requested degree program is now active."
          : `Your major change request was denied.${reviewNote ? ` ${reviewNote}` : ""}`,
      ]
    );
    await client.query("COMMIT");
    return res.json({ message: `Major change request ${decision}.` });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Unable to review major change request:", error.message);
    return res.status(500).json({ message: "Unable to review major change request." });
  } finally {
    client.release();
  }
}

module.exports = {
  listStudentMajorChangeData,
  createMajorChangeRequest,
  withdrawMajorChangeRequest,
  listAdminMajorChangeRequests,
  reviewMajorChangeRequest,
};
