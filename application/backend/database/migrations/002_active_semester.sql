BEGIN;

ALTER TABLE public.semester
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_semester_per_school
    ON public.semester (school_id)
    WHERE is_active = TRUE;

-- Preserve the application's existing current term when this migration is
-- first deployed. If a school has Summer 2026, it becomes its active term.
UPDATE public.semester target
SET is_active = TRUE
WHERE target.term_year = 2026
  AND target.term_type = 'Summer'
  AND NOT EXISTS (
      SELECT 1 FROM public.semester active
      WHERE active.school_id = target.school_id
        AND active.is_active = TRUE
  );

COMMIT;
