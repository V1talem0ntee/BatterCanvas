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

function timeToMinutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function classSummary(row) {
  return {
    classSectionId: row.class_section_id,
    courseId: row.course_id,
    subjectCode: row.subject_code,
    courseNumber: row.course_number,
    title: row.course_title,
    sectionNumber: row.section_number,
    startTime: row.meeting_start_time,
    endTime: row.meeting_end_time,
    location: row.building_id
      ? {
          buildingId: row.building_id,
          buildingName: row.building_name,
          roomNumber: row.room_number,
          mapElementId: row.map_element_id,
        }
      : null,
  };
}

function distanceKey(originBuildingId, destinationBuildingId) {
  return `${originBuildingId}:${destinationBuildingId}`;
}

async function listWalkingWarnings(req, res) {
  if (!requireStudent(req, res)) {
    return;
  }

  try {
    const [studentResult, sectionResult, distanceResult] =
      await Promise.all([
        pool.query(
          `SELECT walking_speed_mps
           FROM public.student
           WHERE student_id = $1`,
          [req.auth.userId]
        ),

        pool.query(
          `SELECT
             c.course_id,
             c.subject_code,
             c.course_number,
             c.course_title,
             cs.class_section_id,
             cs.semester_id,
             cs.section_number,
             cs.meeting_start_time,
             cs.meeting_end_time,
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
             ON b.building_id = cr.building_id
           WHERE cs.section_status <> 'cancelled'
           ORDER BY
             cs.semester_id,
             cs.meeting_start_time,
             c.subject_code,
             c.course_number`,
          [req.auth.userId]
        ),

        pool.query(
          `SELECT
             origin_building_id,
             destination_building_id,
             distance_meters
           FROM public.building_distance`
        ),
      ]);

    const student = studentResult.rows[0];

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found.",
      });
    }

    const walkingSpeedMps = Number(student.walking_speed_mps) || 1.4;

    const distances = new Map();

    for (const row of distanceResult.rows) {
      distances.set(
        distanceKey(row.origin_building_id, row.destination_building_id),
        Number(row.distance_meters)
      );

      distances.set(
        distanceKey(row.destination_building_id, row.origin_building_id),
        Number(row.distance_meters)
      );
    }

    const warnings = [];

    for (const dayOfWeek of WEEKDAY_ORDER) {
      const sectionsForDay = sectionResult.rows.filter((row) => {
        return (row.meeting_days || []).includes(dayOfWeek);
      });

      const semesterIds = Array.from(
        new Set(sectionsForDay.map((row) => row.semester_id))
      );

      for (const semesterId of semesterIds) {
        const sections = sectionsForDay
          .filter((row) => row.semester_id === semesterId)
          .sort((a, b) => {
            return (
              timeToMinutes(a.meeting_start_time) -
              timeToMinutes(b.meeting_start_time)
            );
          });

        for (let index = 0; index < sections.length - 1; index += 1) {
          const current = sections[index];
          const next = sections[index + 1];

          if (!current.building_id || !next.building_id) {
            continue;
          }

          const gapMinutes =
            timeToMinutes(next.meeting_start_time) -
            timeToMinutes(current.meeting_end_time);

          if (gapMinutes < 0) {
            continue;
          }

          const distanceMeters =
            current.building_id === next.building_id
              ? 0
              : distances.get(
                  distanceKey(current.building_id, next.building_id)
                );

          if (distanceMeters === undefined) {
            warnings.push({
              dayOfWeek,
              semesterId,
              type: "walking-time-unknown",
              message:
                "Walking distance between these buildings is not available.",
              fromClass: classSummary(current),
              toClass: classSummary(next),
              gapMinutes,
              walkingSpeedMps,
              distanceMeters: null,
              estimatedWalkingMinutes: null,
              isWarning: true,
            });

            continue;
          }

          const estimatedWalkingMinutes = Math.ceil(
            distanceMeters / walkingSpeedMps / 60
          );

          if (estimatedWalkingMinutes > gapMinutes) {
            warnings.push({
              dayOfWeek,
              semesterId,
              type: "walking-time-conflict",
              message:
                "Estimated walking time is longer than the gap between classes.",
              fromClass: classSummary(current),
              toClass: classSummary(next),
              gapMinutes,
              walkingSpeedMps,
              distanceMeters,
              estimatedWalkingMinutes,
              isWarning: true,
            });
          }
        }
      }
    }

    return res.json({ warnings });
  } catch (error) {
    console.error("Unable to load walking warnings:", error.message);

    return res.status(500).json({
      message: "Unable to load walking warnings.",
    });
  }
}

module.exports = {
  listWalkingWarnings,
};