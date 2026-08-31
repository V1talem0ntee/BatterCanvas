const { pool } = require("../db");

function cleanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function notificationRow(row) {
  return {
    notificationId: row.notification_id,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
  };
}

function timeMinutes(value) {
  const [hours, minutes] = String(value || "0:0").split(":").map(Number);
  return hours * 60 + minutes;
}

function courseLabel(row) {
  return `${row.subject_code} ${row.course_number} Section ${row.section_number}`;
}

function buildConflictEvents(sectionRows, walkingSpeedMps, distanceRows) {
  const events = [];
  const distances = new Map();

  for (const row of distanceRows) {
    distances.set(
      `${row.origin_building_id}:${row.destination_building_id}`,
      Number(row.distance_meters)
    );
    distances.set(
      `${row.destination_building_id}:${row.origin_building_id}`,
      Number(row.distance_meters)
    );
  }

  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  for (const day of weekdays) {
    const sections = sectionRows
      .filter((row) => (row.meeting_days || []).includes(day))
      .sort((a, b) =>
        String(a.meeting_start_time).localeCompare(
          String(b.meeting_start_time)
        )
      );

    for (let first = 0; first < sections.length; first += 1) {
      for (let second = first + 1; second < sections.length; second += 1) {
        const current = sections[first];
        const next = sections[second];

        if (current.semester_id !== next.semester_id) {
          continue;
        }

        if (
          current.meeting_start_time < next.meeting_end_time &&
          current.meeting_end_time > next.meeting_start_time
        ) {
          events.push({
            notification_type: "schedule-conflict",
            title: `Schedule conflict on ${day}`,
            message: `${courseLabel(current)} overlaps with ${courseLabel(next)}.`,
          });
        }
      }
    }

    for (let index = 0; index < sections.length - 1; index += 1) {
      const current = sections[index];
      const next = sections[index + 1];

      if (
        current.semester_id !== next.semester_id ||
        !current.building_id ||
        !next.building_id
      ) {
        continue;
      }

      const gapMinutes =
        timeMinutes(next.meeting_start_time) -
        timeMinutes(current.meeting_end_time);

      if (gapMinutes < 0) {
        continue;
      }

      const distance =
        current.building_id === next.building_id
          ? 0
          : distances.get(`${current.building_id}:${next.building_id}`);

      if (distance === undefined) {
        continue;
      }

      const walkingMinutes = Math.ceil(distance / walkingSpeedMps / 60);

      if (walkingMinutes > gapMinutes) {
        events.push({
          notification_type: "walking-time-conflict",
          title: `Insufficient walking time on ${day}`,
          message: `${courseLabel(current)} to ${courseLabel(next)} allows ${gapMinutes} minutes, but the estimated walk is ${walkingMinutes} minutes.`,
        });
      }
    }
  }

  return events;
}

async function listNotifications(req, res) {
  const requestedType = String(req.query.type || "").trim();
  const values = [req.auth.userId];
  let typeFilter = "";

  if (requestedType) {
    values.push(requestedType);
    typeFilter = `AND notification_type = $${values.length}`;
  }

  try {
    const result = await pool.query(
      `SELECT notification_id, notification_type, title, message, created_at
       FROM public.notification
       WHERE user_id = $1
       ${typeFilter}
       ORDER BY created_at DESC, notification_id DESC`,
      values
    );

    const counts = result.rows.reduce((summary, row) => {
      summary[row.notification_type] =
        (summary[row.notification_type] || 0) + 1;
      return summary;
    }, {});

    return res.json({
      notifications: result.rows.map(notificationRow),
      total: result.rows.length,
      counts,
    });
  } catch (error) {
    console.error("Unable to load notifications:", error.message);
    return res.status(500).json({
      message: "Unable to load notifications.",
    });
  }
}

async function dismissNotification(req, res) {
  const notificationId = cleanId(req.params.notificationId);

  if (!notificationId) {
    return res.status(400).json({
      message: "A valid notificationId is required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM public.notification
       WHERE notification_id = $1
         AND user_id = $2
       RETURNING notification_id`,
      [notificationId, req.auth.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Unable to dismiss notification:", error.message);
    return res.status(500).json({
      message: "Unable to dismiss notification.",
    });
  }
}

async function dismissAllNotifications(req, res) {
  try {
    const result = await pool.query(
      `DELETE FROM public.notification
       WHERE user_id = $1
       RETURNING notification_id`,
      [req.auth.userId]
    );

    return res.json({
      dismissedCount: result.rowCount,
    });
  } catch (error) {
    console.error("Unable to dismiss notifications:", error.message);
    return res.status(500).json({
      message: "Unable to dismiss notifications.",
    });
  }
}

async function createAdminNotification(req, res) {
  const title = String(req.body.title || "").trim();
  const message = String(req.body.message || "").trim();
  const notificationType = String(
    req.body.notificationType || "admin-message"
  ).trim();

  const studentId = cleanId(req.body.studentId);
  const sendToAll = Boolean(req.body.sendToAll);

  if (!title || !message) {
    return res.status(400).json({
      message: "Title and message are required.",
    });
  }

  if (!sendToAll && !studentId) {
    return res.status(400).json({
      message: "Choose a student or send to all students.",
    });
  }

  try {
    if (sendToAll) {
      const result = await pool.query(
        `INSERT INTO public.notification
         (user_id, notification_type, title, message)
         SELECT student_id, $1, $2, $3
         FROM public.student
         RETURNING notification_id`,
        [notificationType, title, message]
      );

      return res.status(201).json({
        message: "Notification sent to all students.",
        createdCount: result.rowCount,
      });
    }

    const studentResult = await pool.query(
      `SELECT student_id
       FROM public.student
       WHERE student_id = $1`,
      [studentId]
    );

    if (!studentResult.rows.length) {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    const result = await pool.query(
      `INSERT INTO public.notification
       (user_id, notification_type, title, message)
       VALUES ($1, $2, $3, $4)
       RETURNING notification_id, notification_type, title, message, created_at`,
      [studentId, notificationType, title, message]
    );

    return res.status(201).json({
      message: "Notification sent.",
      createdCount: 1,
      notification: notificationRow(result.rows[0]),
    });
  } catch (error) {
    console.error("Unable to create admin notification:", error.message);

    return res.status(500).json({
      message: "Unable to create notification.",
    });
  }
}

async function loadTimeBasedEvents(client, userId) {
  const result = await client.query(
    `SELECT
       'enrollment' AS notification_type,
       'Enrollment period is open' AS title,
       'Enrollment for ' || s.term_type || ' ' || s.term_year ||
         ' is available until ' || TO_CHAR(ew.enrollment_end, 'Mon DD, YYYY') || '.' AS message
     FROM public.student st
     JOIN public.enrollment_window ew
       ON ew.student_type = st.student_type
      AND ew.academic_level = st.academic_level
     JOIN public.semester s ON s.semester_id = ew.semester_id
     WHERE st.student_id = $1
       AND CURRENT_TIMESTAMP BETWEEN ew.enrollment_start AND ew.enrollment_end

     UNION ALL

     SELECT
       'deadline' AS notification_type,
       deadline.name || ' approaching' AS title,
       deadline.name || ' for ' || s.term_type || ' ' || s.term_year ||
         ' is ' || TO_CHAR(deadline.due_date, 'Mon DD, YYYY') || '.' AS message
     FROM public.app_user u
     JOIN public.semester s ON s.school_id = u.school_id
     CROSS JOIN LATERAL (
       VALUES
         ('Add/drop deadline', s.add_drop_deadline),
         ('Withdrawal deadline', s.withdrawal_deadline)
     ) AS deadline(name, due_date)
     WHERE u.user_id = $1
       AND deadline.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14`,
    [userId]
  );

  return result.rows;
}

async function loadConflictEvents(client, userId) {
  const studentResult = await client.query(
    `SELECT walking_speed_mps
     FROM public.student
     WHERE student_id = $1`,
    [userId]
  );

  const sectionResult = await client.query(
    `SELECT
       cs.class_section_id,
       cs.semester_id,
       cs.section_number,
       cs.meeting_start_time,
       cs.meeting_end_time,
       c.subject_code,
       c.course_number,
       b.building_id,
       ARRAY(
         SELECT md.day_of_week
         FROM public.meeting_day md
         WHERE md.class_section_id = cs.class_section_id
       ) AS meeting_days
     FROM (
       SELECT e.class_section_id
       FROM public.enrollment e
       WHERE e.student_id = $1
         AND e.enrollment_status = 'enrolled'

       UNION

       SELECT cc.class_section_id
       FROM public.class_cart cc
       WHERE cc.student_id = $1
     ) selected
     JOIN public.class_section cs
       ON cs.class_section_id = selected.class_section_id
     JOIN public.course c
       ON c.course_id = cs.course_id
     LEFT JOIN public.classroom cr
       ON cr.classroom_id = cs.classroom_id
     LEFT JOIN public.building b
       ON b.building_id = cr.building_id`,
    [userId]
  );

  const distanceResult = await client.query(
    `SELECT origin_building_id, destination_building_id, distance_meters
     FROM public.building_distance`
  );

  const walkingSpeedMps =
    Number(studentResult.rows[0]?.walking_speed_mps) || 1.4;

  return buildConflictEvents(
    sectionResult.rows,
    walkingSpeedMps,
    distanceResult.rows
  );
}

async function syncNotifications(req, res) {
  if (req.auth.role !== "student") {
    return res.status(403).json({
      message: "Student access required.",
    });
  }

  const client = await pool.connect();
  let createdCount = 0;

  try {
    await client.query("BEGIN");

    const timeEvents = await loadTimeBasedEvents(client, req.auth.userId);
    const conflictEvents = await loadConflictEvents(client, req.auth.userId);
    const events = [...timeEvents, ...conflictEvents];

    await client.query(
      `DELETE FROM public.notification
       WHERE user_id = $1
         AND notification_type IN ('schedule-conflict', 'walking-time-conflict')`,
      [req.auth.userId]
    );

    for (const event of events) {
      const result = await client.query(
        `INSERT INTO public.notification
   (user_id, notification_type, title, message)
   SELECT $1::int, $2::varchar, $3::varchar, $4::text
   WHERE NOT EXISTS (
     SELECT 1
     FROM public.notification
     WHERE user_id = $1::int
       AND notification_type = $2::varchar
       AND title = $3::varchar
       AND message = $4::text
   )
   RETURNING notification_id`,
        [
          req.auth.userId,
          event.notification_type,
          event.title,
          event.message,
        ]
      );

      createdCount += result.rows.length;
    }

    await client.query("COMMIT");

    return res.json({
      createdCount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Unable to sync notifications:", error.message);

    return res.status(500).json({
      message: "Unable to sync notifications.",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  buildConflictEvents,
  listNotifications,
  dismissNotification,
  dismissAllNotifications,
  syncNotifications,
  createAdminNotification,
};