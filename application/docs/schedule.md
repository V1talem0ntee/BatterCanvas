# Schedule

## Overview

The Schedule page shows a student's Cart and Enrolled class sections in a
weekly calendar. Cart classes are tentative, while Enrolled classes are part
of the student's official schedule.

## Main Features

- View Monday through Friday classes by start and end time.
- Distinguish Cart and Enrolled classes by color.
- Filter the calendar by class status.
- View course, section, time, and location information.
- Remove a tentative class from the Cart.
- See class time conflicts.
- See insufficient walking-time warnings between buildings.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/calendar` | Load Cart and Enrolled sections and time conflicts |
| `GET` | `/api/walking-warnings` | Load walking-time conflicts |
| `DELETE` | `/api/cart/sections/:classSectionId` | Remove a section from the Cart |

All endpoints require a Student authentication token.

## Display Rules

- Enrolled sections use green styling.
- Cart sections use orange styling.
- Sections involved in any conflict use a red border.
- Course-level Planned Schedule records are not displayed.

## Related Files

- `frontend/src/Schedule.jsx`
- `frontend/src/Schedule.css`
- `backend/controllers/calendar.js`
- `backend/controllers/walkingWarnings.js`
- `backend/routes/studentPlanningRoutes.js`