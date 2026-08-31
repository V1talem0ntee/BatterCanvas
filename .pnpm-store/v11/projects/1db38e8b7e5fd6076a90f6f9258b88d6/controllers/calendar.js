const { pool } = require("../db");

const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function requireStudent(req, res) {
  if (req.auth.role !== "student") {
    res.status(403).json({
      message: "Student access required.",
    });
    return false;
  }

  return true;
}

function calendarEventRow(row, dayOfWeek) {
  return {
    classSectionId: row.class_section_id,
    courseId: row.course_id,
    semesterId: row.semester_id,
    termYear: row.term_year,
    termType: row.term_type,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    units: row.course_units,
    sectionNumber: row.section_number,
    startTime: row.meeting_start_time,
    endTime: row.meeting_end_time,
    dayOfWeek,
    status: row.calendar_status,
    sectionStatus: row.section_status,
    modality: row.modality,
    meetingType: row.meeting_type,
    instructor: {
      firstName: row.instructor_first_name,
      lastName: row.instructor_last_name,
    },
    location: row.building_name
      ? {
        buildingId: row.building_id,
        buildingName: row.building_name,
        roomNumber: row.room_number,
        mapElementId: row.map_element_id,
      }
      : null,
  };
}

function emptyCalendar() {
  return WEEKDAY_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    events: [],
  }));
}

function findTimeConflicts(calendar) {
  const conflicts = [];
  const seenConflicts = new Map();

  for (const dayGroup of calendar) {
    const events = [...dayGroup.events].sort((a, b) =>
      String(a.startTime).localeCompare(String(b.startTime))
    );

    for (let index = 0; index < events.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < events.length; nextIndex += 1) {
        const current = events[index];
        const next = events[nextIndex];

        if (
          current.semesterId === next.semesterId &&
          current.startTime < next.endTime &&
          current.endTime > next.startTime
        ) {
          const firstId = Math.min(
            current.classSectionId,
            next.classSectionId
          );

          const secondId = Math.max(
            current.classSectionId,
            next.classSectionId
          );

          const conflictKey = `${current.semesterId}:${firstId}:${secondId}`;

          if (seenConflicts.has(conflictKey)) {
            const existingConflict = seenConflicts.get(conflictKey);

            if (!existingConflict.days.includes(dayGroup.dayOfWeek)) {
              existingConflict.days.push(dayGroup.dayOfWeek);
              existingConflict.dayOfWeek = existingConflict.days.join(", ");
            }

            continue;
          }

          const conflict = {
            semesterId: current.semesterId,
            termYear: current.termYear,
            termType: current.termType,
            dayOfWeek: dayGroup.dayOfWeek,
            days: [dayGroup.dayOfWeek],
            type: "schedule-conflict",
            message: "Two class sections overlap in time.",
            sections: [current, next],
          };

          seenConflicts.set(conflictKey, conflict);
          conflicts.push(conflict);
        }
      }
    }
  }

  return conflicts;
}

async function getCalendar(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (selected.calendar_status, cs.class_section_id)
        selected.calendar_status,
        c.course_id,
        c.subject_code,
        c.course_number,
        c.course_title,
        c.course_units,
        cs.class_section_id,
        cs.semester_id,
        s.term_year,
        s.term_type,
        cs.section_number,
        cs.modality,
        cs.meeting_type,
        cs.section_status,
        cs.meeting_start_time,
        cs.meeting_end_time,
        i.first_name AS instructor_first_name,
        i.last_name AS instructor_last_name,
        b.building_id,
        b.building_name,
        b.map_element_id,
        cr.room_number,
        ARRAY(
          SELECT md.day_of_week
          FROM public.meeting_day md
          WHERE md.class_section_id = cs.class_section_id
          ORDER BY
            CASE md.day_of_week
              WHEN 'Monday' THEN 1
              WHEN 'Tuesday' THEN 2
              WHEN 'Wednesday' THEN 3
              WHEN 'Thursday' THEN 4
              WHEN 'Friday' THEN 5
              WHEN 'Saturday' THEN 6
              WHEN 'Sunday' THEN 7
            END
        ) AS meeting_days
      FROM (
        SELECT e.class_section_id, 'enrolled' AS calendar_status
        FROM public.enrollment e
        WHERE e.student_id = $1
          AND e.enrollment_status IN ('enrolled', 'completed')
        UNION ALL
        SELECT cc.class_section_id, 'cart' AS calendar_status
        FROM public.class_cart cc
        WHERE cc.student_id = $1
      ) selected
      JOIN public.class_section cs
        ON cs.class_section_id = selected.class_section_id
      JOIN public.course c
        ON c.course_id = cs.course_id
      JOIN public.semester s
        ON s.semester_id = cs.semester_id
      JOIN public.instructor i
        ON i.instructor_id = cs.instructor_id
      LEFT JOIN public.classroom cr
        ON cr.classroom_id = cs.classroom_id
      LEFT JOIN public.building b
        ON b.building_id = cr.building_id
      ORDER BY
        selected.calendar_status,
        cs.class_section_id,
        cs.meeting_start_time,
        c.subject_code,
        c.course_number,
        cs.section_number`,
      [req.auth.userId]
    );

    const calendar = emptyCalendar();
    const byDay = new Map(
      calendar.map((dayGroup) => [dayGroup.dayOfWeek, dayGroup.events])
    );

    for (const row of result.rows) {
      for (const dayOfWeek of row.meeting_days || []) {
        byDay.get(dayOfWeek)?.push(calendarEventRow(row, dayOfWeek));
      }
    }

    for (const dayGroup of calendar) {
      dayGroup.events.sort((a, b) =>
        String(a.startTime).localeCompare(String(b.startTime))
      );
    }

    return res.json({
      calendar,
      conflicts: findTimeConflicts(calendar),
    });
  } catch (error) {
    console.error("Unable to load calendar:", error.message);

    return res.status(500).json({
      message: "Unable to load calendar.",
    });
  }
}

module.exports = {
  getCalendar,
};
