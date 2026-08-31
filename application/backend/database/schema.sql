BEGIN;

SET search_path TO public;

CREATE TABLE school
(
    school_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_name VARCHAR(200) NOT NULL
);

CREATE TABLE building
(
    building_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id      INT          NOT NULL,
    building_name  VARCHAR(200) NOT NULL,
    map_element_id VARCHAR(100) NOT NULL,

    CONSTRAINT fk_building_school
        FOREIGN KEY (school_id)
            REFERENCES school (school_id),
    CONSTRAINT unique_building_school_name
        UNIQUE (school_id, building_name),
    CONSTRAINT unique_building_school_map_element
        UNIQUE (school_id, map_element_id)
);

CREATE TABLE building_type
(
    building_id   INT          NOT NULL,
    building_type VARCHAR(100) NOT NULL,

    PRIMARY KEY (building_id, building_type),

    CONSTRAINT fk_building_type_building
        FOREIGN KEY (building_id)
            REFERENCES building (building_id),
    CONSTRAINT check_building_type
        CHECK (building_type IN (
                                 'academic', 'gym', 'library', 'student_center', 'dining', 'administration', 'parking'
            )
            )
);

CREATE TABLE building_distance
(
    origin_building_id      INT            NOT NULL,
    destination_building_id INT            not NULL,
    distance_meters         NUMERIC(10, 2) NOT NULL,

    PRIMARY KEY (origin_building_id, destination_building_id),

    CONSTRAINT fk_building_distance_origin
        FOREIGN KEY (origin_building_id)
            REFERENCES building (building_id),
    CONSTRAINT fk_building_distance_destination
        FOREIGN KEY (destination_building_id)
            REFERENCES building (building_id),
    CONSTRAINT check_building_distance_valid
        CHECK (distance_meters >= 0),
    CONSTRAINT check_building_distance_distinct
        CHECK (origin_building_id != destination_building_id)
);

CREATE TABLE classroom
(
    classroom_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    building_id  INT        NOT NULL,
    room_number  VARCHAR(5) NOT NULL,
    CONSTRAINT fk_classroom_building
        FOREIGN KEY (building_id)
            REFERENCES building (building_id),
    CONSTRAINT unique_classroom
        UNIQUE (building_id, room_number)
);

CREATE TABLE department
(
    department_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id       INT          NOT NULL,
    building_id     INT          NOT NULL,
    department_name VARCHAR(50)  NOT NULL,
    office_email    VARCHAR(300) NOT NULL,
    office_phone    VARCHAR(20)  NOT NULL,

    CONSTRAINT fk_department_school
        FOREIGN KEY (school_id)
            REFERENCES school (school_id),
    CONSTRAINT fk_department_building
        FOREIGN KEY (building_id)
            REFERENCES building (building_id),
    CONSTRAINT unique_department_school
        UNIQUE (school_id, department_name)
);

CREATE TABLE major
(
    major_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id INT          NOT NULL,
    major_name    VARCHAR(100) NOT NULL,
    CONSTRAINT fk_major_department
        FOREIGN KEY (department_id)
            REFERENCES department (department_id),
    CONSTRAINT unique_major_name_department
        UNIQUE (department_id, major_name)
);

CREATE TABLE semester
(
    semester_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id           INT         NOT NULL,
    term_year           INT         NOT NULL,
    term_type           VARCHAR(10) NOT NULL,
    start_date          DATE        NOT NULL,
    end_date            DATE        NOT NULL,
    add_drop_deadline   DATE        NOT NULL,
    withdrawal_deadline DATE        NOT NULL,
    is_active           BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_semester_school
        FOREIGN KEY (school_id)
            REFERENCES school (school_id),

    CONSTRAINT unique_semester_school_term
        UNIQUE (school_id, term_year, term_type),
    CONSTRAINT check_semester_term_type
        CHECK (term_type IN ('Fall', 'Spring', 'Summer', 'Winter')),
    CONSTRAINT check_semester_date
        CHECK (
            start_date < end_date
                AND add_drop_deadline >= start_date
                AND withdrawal_deadline >= add_drop_deadline
                AND withdrawal_deadline <= end_date
            )
);

CREATE UNIQUE INDEX unique_active_semester_per_school
    ON semester (school_id)
    WHERE is_active = TRUE;

CREATE TABLE degree_program
(
    degree_program_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    major_id             INT         NOT NULL,
    degree_type          VARCHAR(10) NOT NULL,
    catalog_year         INT         NOT NULL,
    required_major_units INT         NOT NULL,
    required_ge_units    INT         NOT NULL,

    CONSTRAINT fk_degree_program_major
        FOREIGN KEY (major_id)
            REFERENCES major (major_id),
    CONSTRAINT unique_degree_program
        UNIQUE (major_id, degree_type, catalog_year),
    CONSTRAINT check_degree_program_type
        CHECK (degree_type IN ('BA', 'BS', 'BFA', 'MA', 'MS', 'PHD')),
    CONSTRAINT check_degree_program_units
        CHECK (required_major_units >= 0 AND required_ge_units >= 0)

);

CREATE TABLE app_user
(
    user_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id           INT          NOT NULL,
    username            VARCHAR(100),
    institutional_email VARCHAR(200),
    password_hash       VARCHAR(200) NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    user_role           VARCHAR(20)  NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL,
    last_login_at       TIMESTAMPTZ,

    CONSTRAINT fk_app_user_school
        FOREIGN KEY (school_id)
            REFERENCES school (school_id),
    CONSTRAINT unique_app_user_school_email
        UNIQUE (school_id, institutional_email),
    CONSTRAINT unique_app_user_school_username
        UNIQUE (school_id, username),
    CONSTRAINT check_app_user_identity
        CHECK (
            (user_role = 'student' AND institutional_email IS NOT NULL)
                OR (user_role = 'admin' AND username IS NOT NULL)
            ),
    CONSTRAINT check_app_user_role
        CHECK (user_role IN ('student', 'admin'))
);

CREATE TABLE account_invitation
(
    invitation_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    external_id         VARCHAR(100) NOT NULL,
    user_role           VARCHAR(20)  NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    phone_number        VARCHAR(30),
    zip_code            VARCHAR(20),
    institutional_email VARCHAR(200),
    created_by          INT,
    claimed_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_account_invitation_external_id
        UNIQUE (external_id),
    CONSTRAINT unique_account_invitation_email
        UNIQUE (institutional_email),
    CONSTRAINT fk_account_invitation_created_by
        FOREIGN KEY (created_by)
            REFERENCES app_user (user_id),
    CONSTRAINT check_account_invitation_role
        CHECK (user_role IN ('student', 'admin')),
    CONSTRAINT check_account_invitation_student_identity
        CHECK (
            user_role != 'student'
                OR (
                    phone_number IS NOT NULL
                        AND zip_code IS NOT NULL
                        AND institutional_email IS NOT NULL
                    )
            )
);

CREATE TABLE student
(
    student_id                      INT PRIMARY KEY,
    school_student_id               VARCHAR(100)  NOT NULL UNIQUE,
    degree_program_id               INT,
    expected_graduation_semester_id INT,
    academic_level                  VARCHAR(20),
    student_type                    VARCHAR(30),
    total_credits                   INT           NOT NULL DEFAULT 0,
    city                            VARCHAR(100),
    street                          VARCHAR(200),
    state                           VARCHAR(100),
    zip_code                        VARCHAR(20)   NOT NULL,
    phone_number                    VARCHAR(30),
    walking_speed_mps               NUMERIC(5, 2) NOT NULL DEFAULT 1.40,

    CONSTRAINT fk_student_user
        FOREIGN KEY (student_id)
            REFERENCES app_user (user_id),
    CONSTRAINT fk_student_degree_program
        FOREIGN KEY (degree_program_id)
            REFERENCES degree_program (degree_program_id),
    CONSTRAINT fk_student_expected_graduation_semester
        FOREIGN KEY (expected_graduation_semester_id)
            REFERENCES semester (semester_id),
    CONSTRAINT check_student_academic_level
        CHECK (academic_level IN ('freshman', 'sophomore', 'junior', 'senior', 'graduate')),
    CONSTRAINT check_student_type
        CHECK (student_type IN ('first-time', 'continuing', 'transfer', 'international')),
    CONSTRAINT check_student_units
        CHECK (total_credits >= 0),
    CONSTRAINT check_student_walking_speed
        CHECK (walking_speed_mps > 0)
);

CREATE TABLE admin
(
    admin_id                  INT PRIMARY KEY,
    institutional_employee_id VARCHAR(100) NOT NULL UNIQUE,

    CONSTRAINT fk_admin_user
        FOREIGN KEY (admin_id)
            REFERENCES app_user (user_id)
);

CREATE TABLE major_change_request
(
    major_change_request_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id                  INT NOT NULL REFERENCES student (student_id) ON DELETE CASCADE,
    current_degree_program_id   INT REFERENCES degree_program (degree_program_id),
    requested_degree_program_id INT NOT NULL REFERENCES degree_program (degree_program_id),
    request_reason              VARCHAR(1000),
    request_status              VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (request_status IN ('pending', 'approved', 'denied', 'withdrawn')),
    submitted_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by                 INT REFERENCES admin (admin_id),
    reviewed_at                 TIMESTAMPTZ,
    review_note                 VARCHAR(1000),
    CONSTRAINT major_change_request_different_program
        CHECK (current_degree_program_id IS NULL OR current_degree_program_id <> requested_degree_program_id)
);

CREATE UNIQUE INDEX one_pending_major_change_per_student
    ON major_change_request (student_id)
    WHERE request_status = 'pending';

CREATE TABLE interface_setting
(
    setting_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id        INT          NOT NULL,
    setting_name    VARCHAR(100) NOT NULL,
    setting_value   VARCHAR(200) NOT NULL,
    last_updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_interface_setting_admin
        FOREIGN KEY (admin_id)
            REFERENCES admin (admin_id)

);

CREATE TABLE instructor
(
    instructor_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    institutional_email VARCHAR(300) NOT NULL UNIQUE
);

CREATE TABLE ge_area
(
    ge_area_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id    INT           NOT NULL,
    ge_area_code VARCHAR(20)   NOT NULL,
    ge_area_name VARCHAR(200)  NOT NULL,
    description  VARCHAR(1000) NOT NULL,

    CONSTRAINT fk_ge_area_school
        FOREIGN KEY (school_id)
            REFERENCES school (school_id),
    CONSTRAINT unique_ge_area_code_school
        UNIQUE (school_id, ge_area_code)
);

CREATE TABLE course
(
    course_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id      INT          NOT NULL,
    subject_code       VARCHAR(20)  NOT NULL,
    course_number      VARCHAR(20)  NOT NULL,
    course_title       VARCHAR(2000) NOT NULL,
    course_description VARCHAR(100000) NOT NULL,
    course_units       INT          NOT NULL,
    course_level       VARCHAR(20)  NOT NULL,
    course_category    VARCHAR(20)  NOT NULL DEFAULT 'major-core',
    repeatable         BOOLEAN      NOT NULL,
    section_type       VARCHAR(20)  NOT NULL,

    CONSTRAINT fk_course_department
        FOREIGN KEY (department_id)
            REFERENCES department (department_id),
    CONSTRAINT unique_course_code_department
        UNIQUE (department_id, subject_code, course_number),
    CONSTRAINT check_course_units
        CHECK (course_units > 0),
    CONSTRAINT check_course_section_type
        CHECK (section_type IN ('lecture', 'lab')),
    CONSTRAINT check_course_level
        CHECK (course_level IN ('lower_division', 'upper_division', 'graduate')),
    CONSTRAINT check_course_category
        CHECK (course_category IN ('major-core', 'major-elective', 'ge'))
);

CREATE TABLE course_ge_area
(
    course_id  INT NOT NULL,
    ge_area_id INT NOT NULL,

    PRIMARY KEY (course_id, ge_area_id),

    CONSTRAINT fk_course_ge_area_course
        FOREIGN KEY (course_id)
            REFERENCES course (course_id),
    CONSTRAINT fk_course_ge_area_ge_area
        FOREIGN KEY (ge_area_id)
            REFERENCES ge_area (ge_area_id)
);

CREATE TABLE course_prerequisite
(
    course_id              INT NOT NULL,
    prerequisite_course_id INT NOT NULL,
    minimum_grade          VARCHAR(5),

    PRIMARY KEY (course_id, prerequisite_course_id),

    CONSTRAINT fk_course_prerequisite_course
        FOREIGN KEY (course_id)
            REFERENCES course (course_id),
    CONSTRAINT fk_course_prerequisite_required_course
        FOREIGN KEY (prerequisite_course_id)
            REFERENCES course (course_id),
    CONSTRAINT check_course_prerequisite_distinct
        CHECK (course_id != prerequisite_course_id),
    CONSTRAINT check_course_prerequisite_grade
        CHECK (minimum_grade IS NULL OR minimum_grade IN (
                                                          'A', 'A-', 'B+', 'B', 'B-',
                                                          'C+', 'C', 'C-', 'D+', 'D', 'D-',
                                                          'F', 'P', 'NP'
            ))
);

CREATE TABLE degree_requirement
(
    degree_requirement_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    degree_program_id     INT          NOT NULL,
    ge_area_id            INT,
    requirement_name      VARCHAR(200) NOT NULL,
    requirement_type      VARCHAR(20)  NOT NULL,
    completion_rule       VARCHAR(20)  NOT NULL DEFAULT 'minimum-units',
    required_units        INT          NOT NULL,
    minimum_grade         VARCHAR(5),

    CONSTRAINT fk_degree_requirement_program
        FOREIGN KEY (degree_program_id)
            REFERENCES degree_program (degree_program_id),
    CONSTRAINT fk_degree_requirement_ge_area
        FOREIGN KEY (ge_area_id)
            REFERENCES ge_area (ge_area_id),
    CONSTRAINT check_degree_requirement_type
        CHECK (requirement_type IN (
                                    'major-core',
                                    'major-elective',
                                    'ge-area',
                                    'university-requirement'
            )),
    CONSTRAINT check_degree_requirement_units
        CHECK (required_units >= 0),
    CONSTRAINT check_degree_requirement_completion_rule
        CHECK (completion_rule IN ('all-courses', 'minimum-units')),
    CONSTRAINT check_degree_requirement_grade
        CHECK (minimum_grade IS NULL OR minimum_grade IN ('A', 'A-', 'B+', 'B', 'B-',
                                                          'C+', 'C', 'C-', 'D+', 'D', 'D-',
                                                          'F', 'P', 'NP'
            )
            )
);

CREATE TABLE required_course
(
    requirement_id INT NOT NULL,
    course_id      INT NOT NULL,

    PRIMARY KEY (requirement_id, course_id),

    CONSTRAINT fk_required_course_requirement
        FOREIGN KEY (requirement_id)
            REFERENCES degree_requirement (degree_requirement_id),
    CONSTRAINT fk_required_course_course
        FOREIGN KEY (course_id)
            REFERENCES course (course_id)
);

CREATE TABLE class_section
(
    class_section_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id          INT         NOT NULL,
    semester_id        INT         NOT NULL,
    classroom_id       INT,
    instructor_id      INT         NOT NULL,
    section_number     VARCHAR(20) NOT NULL,
    start_date         DATE        NOT NULL,
    end_date           DATE        NOT NULL,
    meeting_start_time TIME        NOT NULL,
    meeting_end_time   TIME        NOT NULL,
    modality           VARCHAR(20) NOT NULL,
    meeting_type       VARCHAR(20) NOT NULL,
    capacity           INT         NOT NULL,
    enrolled_count     INT         NOT NULL DEFAULT 0,
    waitlist_capacity  INT         NOT NULL DEFAULT 0,
    waitlist_count     INT         NOT NULL DEFAULT 0,
    section_status     VARCHAR(20) NOT NULL,

    CONSTRAINT fk_class_section_course
        FOREIGN KEY (course_id)
            REFERENCES course (course_id),
    CONSTRAINT fk_class_section_semester
        FOREIGN KEY (semester_id)
            REFERENCES semester (semester_id),
    CONSTRAINT fk_class_section_classroom
        FOREIGN KEY (classroom_id)
            REFERENCES classroom (classroom_id),
    CONSTRAINT fk_class_section_instructor
        FOREIGN KEY (instructor_id)
            REFERENCES instructor (instructor_id),
    CONSTRAINT unique_class_section
        UNIQUE (course_id, semester_id, section_number),

    CONSTRAINT check_class_section_dates
        CHECK (start_date <= end_date),
    CONSTRAINT check_class_section_times
        CHECK (meeting_start_time < meeting_end_time),
    CONSTRAINT check_class_section_modality
        CHECK (modality IN ('in-person', 'online', 'hybrid')),
    CONSTRAINT check_class_section_meeting_type
        CHECK (meeting_type IN ('synchronous', 'asynchronous')),
    CONSTRAINT check_class_section_count
        CHECK (capacity >= 0
            AND enrolled_count >= 0
            AND enrolled_count <= capacity
            AND waitlist_capacity >= 0
            AND waitlist_count >= 0
            AND waitlist_count <= waitlist_capacity),
    CONSTRAINT check_class_section_status
        CHECK (section_status IN ('open', 'closed', 'waitlist', 'cancelled'))
);

CREATE TABLE meeting_day
(
    class_section_id INT         NOT NULL,
    day_of_week      VARCHAR(10) NOT NULL,

    PRIMARY KEY (class_section_id, day_of_week),

    CONSTRAINT fk_meeting_day_section
        FOREIGN KEY (class_section_id)
            REFERENCES class_section (class_section_id),
    CONSTRAINT check_meeting_day
        CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'))
);

CREATE TABLE enrollment_window
(
    window_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    semester_id      INT         NOT NULL,
    student_type     VARCHAR(30) NOT NULL,
    academic_level   VARCHAR(20) NOT NULL,
    enrollment_start TIMESTAMPTZ NOT NULL,
    enrollment_end   TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_enrollment_window_semester
        FOREIGN KEY (semester_id)
            REFERENCES semester (semester_id),
    CONSTRAINT unique_enrollment_window
        UNIQUE (semester_id, student_type, academic_level),
    CONSTRAINT check_enrollment_window_student_type
        CHECK (student_type IN ('first-time', 'continuing', 'transfer', 'international')),
    CONSTRAINT check_enrollment_window_academic_level
        CHECK (academic_level IN ('freshman', 'sophomore', 'junior', 'senior', 'graduate')),
    CONSTRAINT check_enrollment_window_dates
        CHECK (enrollment_start < enrollment_end)
);

CREATE TABLE enrollment
(
    student_id        INT         NOT NULL,
    class_section_id  INT         NOT NULL,
    enrollment_date   DATE        NOT NULL,
    enrollment_status VARCHAR(20) NOT NULL,
    grade             VARCHAR(5),

    PRIMARY KEY (student_id, class_section_id),
    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id),
    CONSTRAINT fk_enrollment_section
        FOREIGN KEY (class_section_id)
            REFERENCES class_section (class_section_id),
    CONSTRAINT check_enrollment_status
        CHECK (enrollment_status IN ('enrolled', 'dropped', 'withdrawn', 'completed')),
    CONSTRAINT check_enrollment_grade
        CHECK (grade IN ('A', 'A-', 'B+', 'B', 'B-',
                         'C+', 'C', 'C-', 'D+', 'D', 'D-',
                         'F', 'P', 'NP'))
);

CREATE TABLE student_hold
(
    hold_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id       INT          NOT NULL,
    hold_type        VARCHAR(100) NOT NULL,
    hold_status      VARCHAR(50)  NOT NULL,
    placed_date      DATE         NOT NULL,
    resolved_date    DATE,
    enrollment_block BOOLEAN      NOT NULL,

    CONSTRAINT fk_student_hold_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id),
    CONSTRAINT check_student_hold_dates
        CHECK (resolved_date IS NULL OR resolved_date >= placed_date)
);

CREATE TABLE planned_course
(
    student_id  INT  NOT NULL,
    course_id   INT  NOT NULL,
    semester_id INT  NOT NULL,
    added_date  DATE NOT NULL DEFAULT CURRENT_DATE,

    PRIMARY KEY (student_id, course_id, semester_id),
    CONSTRAINT fk_planned_course_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id),
    CONSTRAINT fk_planned_course_course
        FOREIGN KEY (course_id)
            REFERENCES course (course_id),
    CONSTRAINT fk_planned_course_semester
        FOREIGN KEY (semester_id)
            REFERENCES semester (semester_id)
);

CREATE TABLE degree_roadmap
(
    roadmap_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    degree_program_id INT NOT NULL REFERENCES degree_program (degree_program_id),
    roadmap_name     VARCHAR(200) NOT NULL,
    version_number   INT NOT NULL DEFAULT 1,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (degree_program_id, version_number)
);

CREATE UNIQUE INDEX one_active_roadmap_per_program
    ON degree_roadmap (degree_program_id) WHERE is_active;

CREATE TABLE degree_roadmap_term
(
    roadmap_term_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    roadmap_id      INT NOT NULL REFERENCES degree_roadmap (roadmap_id) ON DELETE CASCADE,
    year_number     INT NOT NULL CHECK (year_number BETWEEN 1 AND 8),
    term_type       VARCHAR(20) NOT NULL CHECK (term_type IN ('Fall', 'Spring', 'Summer', 'Winter')),
    max_courses     INT NOT NULL DEFAULT 4 CHECK (max_courses > 0),
    max_units       INT NOT NULL DEFAULT 15 CHECK (max_units > 0),
    display_order   INT NOT NULL DEFAULT 0,
    UNIQUE (roadmap_id, year_number, term_type)
);

CREATE TABLE degree_roadmap_item
(
    roadmap_item_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    roadmap_term_id       INT NOT NULL REFERENCES degree_roadmap_term (roadmap_term_id) ON DELETE CASCADE,
    item_type             VARCHAR(30) NOT NULL CHECK (item_type IN ('fixed-course', 'requirement-slot')),
    course_id             INT REFERENCES course (course_id),
    degree_requirement_id INT REFERENCES degree_requirement (degree_requirement_id),
    display_order         INT NOT NULL DEFAULT 0,
    CONSTRAINT roadmap_item_target CHECK (
        (item_type = 'fixed-course' AND course_id IS NOT NULL AND degree_requirement_id IS NULL)
        OR (item_type = 'requirement-slot' AND course_id IS NULL AND degree_requirement_id IS NOT NULL)
    )
);

CREATE TABLE student_plan_term
(
    plan_term_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id      INT NOT NULL REFERENCES student (student_id) ON DELETE CASCADE,
    roadmap_term_id INT REFERENCES degree_roadmap_term (roadmap_term_id),
    term_year       INT NOT NULL,
    term_type       VARCHAR(20) NOT NULL CHECK (term_type IN ('Fall', 'Spring', 'Summer', 'Winter')),
    semester_id     INT REFERENCES semester (semester_id) ON DELETE SET NULL,
    display_order   INT NOT NULL DEFAULT 0,
    UNIQUE (student_id, term_year, term_type)
);

CREATE TABLE student_plan_item
(
    plan_item_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_term_id             INT NOT NULL REFERENCES student_plan_term (plan_term_id) ON DELETE CASCADE,
    roadmap_item_id          INT REFERENCES degree_roadmap_item (roadmap_item_id),
    selected_course_id       INT REFERENCES course (course_id),
    selected_class_section_id INT REFERENCES class_section (class_section_id) ON DELETE SET NULL,
    UNIQUE (plan_term_id, roadmap_item_id)
);

CREATE TABLE class_cart
(
    student_id       INT  NOT NULL,
    class_section_id INT  NOT NULL,
    added_date       DATE NOT NULL DEFAULT current_date,

    PRIMARY KEY (student_id, class_section_id),

    CONSTRAINT fk_class_cart_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id),
    CONSTRAINT fk_class_cart_section
        FOREIGN KEY (class_section_id)
            REFERENCES class_section (class_section_id)
);

CREATE TABLE student_charge
(
    charge_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id    INT            NOT NULL,
    semester_id   INT            NOT NULL,
    charge_type   VARCHAR(30)    NOT NULL,
    charge_amount NUMERIC(12, 2) NOT NULL,
    due_date      DATE           NOT NULL,
    charge_status VARCHAR(20)    NOT NULL,

    CONSTRAINT fk_student_charge_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id),
    CONSTRAINT fk_student_charge_semester
        FOREIGN KEY (semester_id)
            REFERENCES semester (semester_id),
    CONSTRAINT check_student_charge_type
        CHECK (charge_type IN
               ('tuition', 'fees', 'housing', 'meal-plan', 'parking', 'insurance', 'student-pass', 'other')),
    CONSTRAINT check_student_charge_amount
        CHECK (charge_amount >= 0),
    CONSTRAINT check_student_charge_status
        CHECK (charge_status IN ('pending', 'paid', 'overdue', 'waived', 'refunded', 'cancelled'))
);

CREATE TABLE financial_aid
(
    financial_aid_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id        INT            NOT NULL,
    semester_id       INT            NOT NULL,
    aid_type          VARCHAR(20)    NOT NULL,
    aid_name          VARCHAR(200)   NOT NULL,
    aid_amount        NUMERIC(12, 2) NOT NULL,
    aid_status        VARCHAR(20)    NOT NULL,
    disbursement_date DATE,
    accepted_date     DATE,

    CONSTRAINT fk_financial_aid_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id),
    CONSTRAINT fk_financial_aid_semester
        FOREIGN KEY (semester_id)
            REFERENCES semester (semester_id),
    CONSTRAINT check_financial_aid_type
        CHECK (aid_type IN ('grant', 'loan', 'scholarship', 'work-study')),
    CONSTRAINT check_financial_aid_amount
        CHECK (aid_amount >= 0),
    CONSTRAINT check_financial_aid_status
        CHECK (aid_status IN ('accepted', 'declined', 'pending', 'disbursed'))
);

CREATE TABLE billing_profile
(
    billing_profile_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id         INT          NOT NULL UNIQUE,
    city               VARCHAR(100) NOT NULL,
    street             VARCHAR(200) NOT NULL,
    state              VARCHAR(100) NOT NULL,
    zip_code           VARCHAR(20)  NOT NULL,

    CONSTRAINT fk_billing_profile_student
        FOREIGN KEY (student_id)
            REFERENCES student (student_id)
);

CREATE TABLE billing_transaction
(
    transaction_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    billing_profile_id INT            NOT NULL,
    transaction_type   VARCHAR(20)    NOT NULL,
    transaction_amount NUMERIC(12, 2) NOT NULL,
    transaction_time   TIMESTAMPTZ    NOT NULL DEFAULT current_timestamp,
    transaction_status VARCHAR(20)    NOT NULL,

    CONSTRAINT fk_billing_transaction_profile
        FOREIGN KEY (billing_profile_id)
            REFERENCES billing_profile (billing_profile_id),
    CONSTRAINT check_transaction_type
        CHECK (transaction_type IN ('payment', 'refund', 'financial-aid')),
    CONSTRAINT check_transaction_amount
        CHECK (transaction_amount >= 0),
    CONSTRAINT check_transaction_status
        CHECK (transaction_status IN ('pending', 'completed', 'failed'))
);

CREATE TABLE notification
(
    notification_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           INT           NOT NULL,
    notification_type VARCHAR(30)   NOT NULL,
    title             VARCHAR(200)  NOT NULL,
    message           VARCHAR(1000) NOT NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
            REFERENCES app_user (user_id),
    CONSTRAINT check_notification_type
        CHECK (notification_type IN
               ('enrollment', 'deadline', 'schedule-conflict', 'walking-time-conflict', 'payment', 'general'))
);

COMMIT;
