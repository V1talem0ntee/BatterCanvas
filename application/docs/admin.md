# Admin Portal

## Overview

The Admin Portal is a role-protected workspace for viewing and maintaining the
academic data used by student-facing pages. Only a signed-in user whose verified
token contains the `admin` role can open these pages or call their APIs.

## Main Features

- View dashboard totals for students, courses, sections, and invitations.
- Search and review student records.
- Create, edit, and delete departments and majors.
- Create, edit, and delete courses and class sections.
- Manage buildings, classrooms, degree programs, and degree requirements.
- Associate courses with degree requirements.
- Choose whether a requirement needs every course in its pool or a minimum
  number of units from the pool.
- Configure course prerequisites and their minimum passing grades.
- Create and revoke student or administrator invitations.

## Authentication

The frontend restores a saved session through `GET /api/auth/session` before it
shows protected content. API requests use a bearer token. An invalid or expired
token returns `401`; a signed-in non-admin user receives `403`.

Tokens expire after eight hours. Logout revocation is stored in backend memory,
so the revocation list is cleared when the backend process restarts.

## API Summary

| Resource | Read operations | Write operations |
| --- | --- | --- |
| Dashboard | statistics | none |
| Reference data | schools, terms, majors, instructors, and classrooms | none |
| Students | list and detail | update academic profile |
| Departments | list with school, office, major, and course totals | create, update, delete |
| Majors | list by department with degree-program totals | create, update, delete |
| Courses | list and detail | create, update, delete |
| Class sections | list and detail | create, update, delete |
| Buildings/classrooms | list and detail | create, update, delete |
| Degree programs | list and detail | create, update, delete |
| Degree requirements | list and detail | create, update, delete; add/remove courses |
| Course prerequisites | included with course detail | add, update, and remove prerequisites |
| Invitations | list | create and revoke |

All routes begin with `/api/admin`. List endpoints accept resource-specific
filters. Large student, course, and section results are paginated with a maximum
page size of 100.

## Validation and Safety

- IDs must be positive integers.
- Course units and capacity fields are checked before database writes.
- Enrollment and waitlist counts cannot exceed their respective capacities.
- SQL values are passed as PostgreSQL parameters rather than interpolated input.
- Destructive actions require confirmation in the Admin Portal.
- Database constraint failures return safe client messages without exposing SQL.

## Testing

Run `npm test` from `application/backend`. Admin tests cover dashboard mapping,
filter validation, missing records, boolean validation, and idempotent course
associations. Token tests cover valid, modified, revoked, unsupported-role, and
role-restricted sessions.

## Related Files

- `frontend/src/AdminInterface.jsx`
- `frontend/src/Admin.css`
- `frontend/src/AuthContext.jsx`
- `frontend/src/ProtectedRoute.jsx`
- `backend/controllers/adminData.js`
- `backend/controllers/adminManagement.js`
- `backend/routes/adminRoutes.js`
- `backend/middleware/token.js`
- `backend/tester/admin.test.js`
- `backend/tester/token.test.js`
