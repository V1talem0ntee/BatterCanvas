BEGIN;

CREATE TABLE IF NOT EXISTS public.major_change_request (
  major_change_request_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INT NOT NULL REFERENCES public.student(student_id) ON DELETE CASCADE,
  current_degree_program_id INT REFERENCES public.degree_program(degree_program_id),
  requested_degree_program_id INT NOT NULL REFERENCES public.degree_program(degree_program_id),
  request_reason VARCHAR(1000),
  request_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'approved', 'denied', 'withdrawn')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT REFERENCES public.admin(admin_id),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(1000),
  CONSTRAINT major_change_request_different_program
    CHECK (current_degree_program_id IS NULL OR current_degree_program_id <> requested_degree_program_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_major_change_per_student
  ON public.major_change_request(student_id)
  WHERE request_status = 'pending';

COMMIT;
