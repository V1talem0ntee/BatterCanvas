BEGIN;

CREATE TABLE IF NOT EXISTS public.degree_roadmap (
  roadmap_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  degree_program_id INT NOT NULL REFERENCES public.degree_program(degree_program_id),
  roadmap_name VARCHAR(200) NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (degree_program_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_roadmap_per_program
  ON public.degree_roadmap(degree_program_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.degree_roadmap_term (
  roadmap_term_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roadmap_id INT NOT NULL REFERENCES public.degree_roadmap(roadmap_id) ON DELETE CASCADE,
  year_number INT NOT NULL CHECK (year_number BETWEEN 1 AND 8),
  term_type VARCHAR(20) NOT NULL CHECK (term_type IN ('Fall', 'Spring', 'Summer', 'Winter')),
  max_courses INT NOT NULL DEFAULT 4 CHECK (max_courses > 0),
  max_units INT NOT NULL DEFAULT 15 CHECK (max_units > 0),
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE (roadmap_id, year_number, term_type)
);

CREATE TABLE IF NOT EXISTS public.degree_roadmap_item (
  roadmap_item_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roadmap_term_id INT NOT NULL REFERENCES public.degree_roadmap_term(roadmap_term_id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('fixed-course', 'requirement-slot')),
  course_id INT REFERENCES public.course(course_id),
  degree_requirement_id INT REFERENCES public.degree_requirement(degree_requirement_id),
  display_order INT NOT NULL DEFAULT 0,
  CONSTRAINT roadmap_item_target CHECK (
    (item_type = 'fixed-course' AND course_id IS NOT NULL AND degree_requirement_id IS NULL)
    OR
    (item_type = 'requirement-slot' AND course_id IS NULL AND degree_requirement_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.student_plan_term (
  plan_term_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INT NOT NULL REFERENCES public.student(student_id) ON DELETE CASCADE,
  roadmap_term_id INT REFERENCES public.degree_roadmap_term(roadmap_term_id),
  term_year INT NOT NULL,
  term_type VARCHAR(20) NOT NULL CHECK (term_type IN ('Fall', 'Spring', 'Summer', 'Winter')),
  semester_id INT REFERENCES public.semester(semester_id) ON DELETE SET NULL,
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE (student_id, term_year, term_type)
);

CREATE TABLE IF NOT EXISTS public.student_plan_item (
  plan_item_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_term_id INT NOT NULL REFERENCES public.student_plan_term(plan_term_id) ON DELETE CASCADE,
  roadmap_item_id INT REFERENCES public.degree_roadmap_item(roadmap_item_id),
  selected_course_id INT REFERENCES public.course(course_id),
  selected_class_section_id INT REFERENCES public.class_section(class_section_id) ON DELETE SET NULL,
  UNIQUE (plan_term_id, roadmap_item_id)
);

COMMIT;
