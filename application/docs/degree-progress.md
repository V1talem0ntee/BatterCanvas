# Degree Progress

## Requirement rules

Administrators configure each degree requirement with a course pool, required
units, minimum grade, and one completion rule:

- `all-courses`: every course in the pool must be passed and the required unit
  total must be reached. This is intended for major core requirements.
- `minimum-units`: any unique passed courses from the pool count until the
  required unit total is reached. This is intended for major electives and GE.

GE requirements may use an explicitly assigned course pool. Older requirements
without an explicit pool fall back to the course-to-GE-area associations.

## Student progress

Completed courses come from completed enrollments. Repeated attempts are
deduplicated by course and only the highest passing grade is used. Current
enrollments are shown as in progress. Sections in the Class Cart, which powers
the Schedule page, are shown as planned. A course already completed or in
progress is not counted again as planned.

The report returns separate major and GE summaries plus each configured
requirement's completed, in-progress, planned, and missing courses. Configured
course prerequisites include their minimum grade and whether the student has
satisfied them.

## Database migration

Existing databases must run
`backend/database/migrations/001_degree_requirement.sql`
before deploying this version. Existing major-core requirements are migrated to
`all-courses`; other requirements are migrated to `minimum-units`.
