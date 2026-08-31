BEGIN;

SET search_path TO public;

INSERT INTO school (school_name)
SELECT 'San Francisco State University'
WHERE NOT EXISTS (
    SELECT 1
    FROM school
    WHERE school_name = 'San Francisco State University'
);

WITH building_seed (
    building_name,
    map_element_id
) AS (
    VALUES
        ('Thornton Hall', 'thornton-hall'),
        ('Hensill Hall', 'hensill-hall'),
        ('Health & Social Sciences', 'health-social-sciences')
)
INSERT INTO building (
    school_id,
    building_name,
    map_element_id
)
SELECT
    s.school_id,
    bs.building_name,
    bs.map_element_id
FROM building_seed bs
JOIN school s
    ON s.school_name = 'San Francisco State University'
WHERE NOT EXISTS (
    SELECT 1
    FROM building b
    WHERE b.school_id = s.school_id
      AND b.building_name = bs.building_name
);

INSERT INTO department (
    school_id,
    building_id,
    department_name,
    office_email,
    office_phone
)
SELECT
    s.school_id,
    b.building_id,
    'Computer Science',
    'cs@sfsu.edu',
    '415-338-1000'
FROM school s
JOIN building b
    ON b.school_id = s.school_id
WHERE s.school_name = 'San Francisco State University'
  AND b.building_name = 'Thornton Hall'
  AND NOT EXISTS (
      SELECT 1
      FROM department d
      WHERE d.school_id = s.school_id
        AND d.department_name = 'Computer Science'
  );

INSERT INTO ge_area (school_id, ge_area_code, ge_area_name, description)
SELECT s.school_id, area.code, area.name, area.description
FROM school s
CROSS JOIN (VALUES
    ('A', 'Area A', 'General Education Area A'),
    ('B', 'Area B', 'General Education Area B'),
    ('C', 'Area C', 'General Education Area C'),
    ('D', 'Area D', 'General Education Area D')
) AS area(code, name, description)
WHERE s.school_name = 'San Francisco State University'
ON CONFLICT (school_id, ge_area_code) DO NOTHING;

INSERT INTO course (
    department_id,
    subject_code,
    course_number,
    course_title,
    course_description,
    course_units,
    course_level,
    repeatable,
    section_type
)
SELECT
    d.department_id,
    'CSC',
    '648',
    'Software Engineering',
    'Practical methods and tools for SW engineering including organizational teamwork.',
    3.00,
    'upper_division',
    FALSE,
    'lecture'
FROM department d
JOIN school s
    ON s.school_id = d.school_id
WHERE s.school_name = 'San Francisco State University'
  AND d.department_name = 'Computer Science'
  AND NOT EXISTS (
      SELECT 1
      FROM course c
      WHERE c.department_id = d.department_id
        AND c.subject_code = 'CSC'
        AND c.course_number = '648'
  );

INSERT INTO course (
    department_id,
    subject_code,
    course_number,
    course_title,
    course_description,
    course_units,
    course_level,
    repeatable,
    section_type
)
SELECT
    d.department_id,
    'CSC',
    '675',
    'Introduction to Database Systems',
    'Relational query languages. Semantic data models. Logical and physical database design. Privacy issues. Implementation techniques.',
    3.00,
    'upper_division',
    FALSE,
    'lecture'
FROM department d
JOIN school s
    ON s.school_id = d.school_id
WHERE s.school_name = 'San Francisco State University'
  AND d.department_name = 'Computer Science'
  AND NOT EXISTS (
      SELECT 1
      FROM course c
      WHERE c.department_id = d.department_id
        AND c.subject_code = 'CSC'
        AND c.course_number = '675'
  );

INSERT INTO course (
    department_id,
    subject_code,
    course_number,
    course_title,
    course_description,
    course_units,
    course_level,
    repeatable,
    section_type
)
SELECT
    d.department_id,
    'CSC',
    '510',
    'Analysis of Algorithms I',
    'Notions of main algorithm design methods. Measures of algorithm complexity in space and time.',
    3.00,
    'upper_division',
    FALSE,
    'lecture'
FROM department d
JOIN school s
    ON s.school_id = d.school_id
WHERE s.school_name = 'San Francisco State University'
  AND d.department_name = 'Computer Science'
  AND NOT EXISTS (
      SELECT 1
      FROM course c
      WHERE c.department_id = d.department_id
        AND c.subject_code = 'CSC'
        AND c.course_number = '510'
  );

INSERT INTO semester (
    school_id,
    term_year,
    term_type,
    start_date,
    end_date,
    add_drop_deadline,
    withdrawal_deadline
)
SELECT
    s.school_id,
    2026,
    'Summer',
    DATE '2026-06-15',
    DATE '2026-08-07',
    DATE '2026-07-13',
    DATE '2026-07-18'
FROM school s
WHERE s.school_name = 'San Francisco State University'
  AND NOT EXISTS (
      SELECT 1
      FROM semester sem
      WHERE sem.school_id = s.school_id
        AND sem.term_year = 2026
        AND sem.term_type = 'Summer'
  );

WITH classroom_seed (
    building_name,
    room_number
) AS (
    VALUES
        ('Thornton Hall', '666'),
        ('Hensill Hall', '201'),
        ('Health & Social Sciences', '102')
)
INSERT INTO classroom (
    building_id,
    room_number
)
SELECT
    b.building_id,
    cs.room_number
FROM classroom_seed cs
JOIN school s
    ON s.school_name = 'San Francisco State University'
JOIN building b
    ON b.school_id = s.school_id
   AND b.building_name = cs.building_name
WHERE NOT EXISTS (
    SELECT 1
    FROM classroom cr
    WHERE cr.building_id = b.building_id
      AND cr.room_number = cs.room_number
);

INSERT INTO instructor (
    first_name,
    last_name,
    institutional_email
)
SELECT
    'Jose',
    'Ortiz-Costa',
    'jortizco@sfsu.edu'
WHERE NOT EXISTS (
    SELECT 1
    FROM instructor
    WHERE institutional_email = 'jortizco@sfsu.edu'
);

WITH section_seed (
    course_number,
    section_number,
    building_name,
    room_number,
    meeting_start_time,
    meeting_end_time,
    modality,
    meeting_type,
    capacity,
    enrolled_count,
    waitlist_capacity,
    waitlist_count,
    section_status
) AS (
    VALUES
        ('648', '01', 'Thornton Hall', '666', TIME '14:30', TIME '16:15', 'in-person', 'synchronous', 30, 24, 10, 0, 'open'),
        ('648', '02', 'Hensill Hall', '201', TIME '09:30', TIME '11:15', 'in-person', 'synchronous', 30, 18, 10, 0, 'open'),
        ('648', '03', 'Health & Social Sciences', '102', TIME '18:00', TIME '19:45', 'hybrid', 'synchronous', 25, 25, 10, 2, 'waitlist'),

        ('675', '01', 'Thornton Hall', '666', TIME '08:00', TIME '09:45', 'in-person', 'synchronous', 35, 22, 10, 0, 'open'),
        ('675', '02', 'Hensill Hall', '201', TIME '11:00', TIME '12:45', 'in-person', 'synchronous', 35, 35, 10, 4, 'waitlist'),
        ('675', '03', 'Health & Social Sciences', '102', TIME '17:00', TIME '18:45', 'hybrid', 'synchronous', 40, 30, 10, 0, 'open'),

        ('510', '01', 'Thornton Hall', '666', TIME '10:00', TIME '11:45', 'in-person', 'synchronous', 40, 32, 10, 0, 'open'),
        ('510', '02', 'Hensill Hall', '201', TIME '13:00', TIME '14:45', 'in-person', 'synchronous', 40, 40, 10, 3, 'waitlist'),
        ('510', '03', 'Health & Social Sciences', '102', TIME '09:00', TIME '10:45', 'hybrid', 'synchronous', 40, 28, 10, 0, 'open')
)
INSERT INTO class_section (
    course_id,
    semester_id,
    classroom_id,
    instructor_id,
    section_number,
    start_date,
    end_date,
    meeting_start_time,
    meeting_end_time,
    modality,
    meeting_type,
    capacity,
    enrolled_count,
    waitlist_capacity,
    waitlist_count,
    section_status
)
SELECT
    c.course_id,
    sem.semester_id,
    cr.classroom_id,
    i.instructor_id,
    ss.section_number,
    sem.start_date,
    sem.end_date,
    ss.meeting_start_time,
    ss.meeting_end_time,
    ss.modality,
    ss.meeting_type,
    ss.capacity,
    ss.enrolled_count,
    ss.waitlist_capacity,
    ss.waitlist_count,
    ss.section_status
FROM section_seed ss
JOIN course c
    ON c.subject_code = 'CSC'
   AND c.course_number = ss.course_number
JOIN department d
    ON d.department_id = c.department_id
JOIN school s
    ON s.school_id = d.school_id
JOIN semester sem
    ON sem.school_id = s.school_id
   AND sem.term_year = 2026
   AND sem.term_type = 'Summer'
JOIN building b
    ON b.school_id = s.school_id
   AND b.building_name = ss.building_name
JOIN classroom cr
    ON cr.building_id = b.building_id
   AND cr.room_number = ss.room_number
JOIN instructor i
    ON i.institutional_email = 'jortizco@sfsu.edu'
WHERE s.school_name = 'San Francisco State University'
ON CONFLICT (course_id, semester_id, section_number)
DO UPDATE SET
    classroom_id = EXCLUDED.classroom_id,
    instructor_id = EXCLUDED.instructor_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    meeting_start_time = EXCLUDED.meeting_start_time,
    meeting_end_time = EXCLUDED.meeting_end_time,
    modality = EXCLUDED.modality,
    meeting_type = EXCLUDED.meeting_type,
    capacity = EXCLUDED.capacity,
    enrolled_count = EXCLUDED.enrolled_count,
    waitlist_capacity = EXCLUDED.waitlist_capacity,
    waitlist_count = EXCLUDED.waitlist_count,
    section_status = EXCLUDED.section_status;

WITH meeting_seed (
    course_number,
    section_number,
    day_of_week
) AS (
    VALUES
        ('648', '01', 'Tuesday'),
        ('648', '01', 'Thursday'),
        ('648', '02', 'Monday'),
        ('648', '02', 'Wednesday'),
        ('648', '03', 'Friday'),

        ('675', '01', 'Tuesday'),
        ('675', '01', 'Thursday'),
        ('675', '02', 'Monday'),
        ('675', '02', 'Wednesday'),
        ('675', '03', 'Friday'),

        ('510', '01', 'Monday'),
        ('510', '01', 'Wednesday'),
        ('510', '02', 'Tuesday'),
        ('510', '02', 'Thursday'),
        ('510', '03', 'Friday')
)
INSERT INTO meeting_day (
    class_section_id,
    day_of_week
)
SELECT
    cs.class_section_id,
    ms.day_of_week
FROM meeting_seed ms
JOIN course c
    ON c.subject_code = 'CSC'
   AND c.course_number = ms.course_number
JOIN class_section cs
    ON cs.course_id = c.course_id
   AND cs.section_number = ms.section_number
JOIN semester sem
    ON sem.semester_id = cs.semester_id
   AND sem.term_year = 2026
   AND sem.term_type = 'Summer'
WHERE NOT EXISTS (
    SELECT 1
    FROM meeting_day md
    WHERE md.class_section_id = cs.class_section_id
      AND md.day_of_week = ms.day_of_week
);

WITH school_row AS (
    SELECT school_id
    FROM school
    WHERE school_name = 'San Francisco State University'
    LIMIT 1
),
created_user AS (
    INSERT INTO app_user (
        school_id,
        institutional_email,
        password_hash,
        first_name,
        last_name,
        user_role,
        created_at
    )
    SELECT
        school_id,
        'admin@sfsu.edu',
        'scrypt:0c4e58561f48bbbc0b0127b72cbf4435:48f9597602abe8bede712d173d59922f62a1b23e744cbfbadf5e922a7b6d33ee9f629fe84ec900766ce19eb1e2a60675196b5bb9460aeead54dc8320904085ac',
        'System',
        'Administrator',
        'admin',
        CURRENT_TIMESTAMP
    FROM school_row
    WHERE NOT EXISTS (
        SELECT 1
        FROM app_user
        WHERE institutional_email = 'admin@sfsu.edu'
    )
    RETURNING user_id
)
INSERT INTO admin (
    admin_id,
    institutional_employee_id
)
SELECT
    user_id,
    'a00000001'
FROM created_user
ON CONFLICT DO NOTHING;

INSERT INTO building_type (building_id, building_type)
VALUES
    (4, 'academic'),
    (5, 'academic'),
    (6, 'academic')
ON CONFLICT (building_id, building_type) DO NOTHING;

COMMIT;
