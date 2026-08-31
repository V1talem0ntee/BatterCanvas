# Planned Schedule

## Overview

The Planned Schedule helps students organize courses by semester before registration.

This page only displays courses. It does not display section number, instructor, meeting time, or classroom because students have not selected a specific class section yet.

## Main Features

Students can:

- View planned courses by semester.
- View the total number of courses and units.
- Remove a course from a semester.
- Go to Course Search to find more courses.

## Planned Course Data

Each planned course contains:

- Course ID
- Course title
- Units
- Semester ID
- Semester year and term

A planned course is identified by both `courseId` and `semesterId`.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/planned-schedule` | View all planned courses |
| `POST` | `/api/planned-schedule` | Add a course to a semester |
| `PATCH` | `/api/planned-schedule/:courseId/:semesterId` | Move a course to another semester |
| `DELETE` | `/api/planned-schedule/:courseId/:semesterId` | Remove a planned course |

All endpoints require the Student's authentication token.

## Related Files

- `frontend/src/PlannedSchedule.jsx` — page layout and API requests
- `frontend/src/PlannedSchedule.css` — page styling
- `backend/routes/plannedScheduleRoutes.js` — backend routes
- `backend/controllers/plannedSchedule.js` — backend logic
- `backend/database/schema.sql` — database structure

