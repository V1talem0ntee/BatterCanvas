BEGIN;

ALTER TABLE public.course
  ADD COLUMN IF NOT EXISTS course_category VARCHAR(20);

UPDATE public.course c
SET course_category = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.course_ge_area cga WHERE cga.course_id = c.course_id
  ) THEN 'ge'
  ELSE 'major-core'
END
WHERE course_category IS NULL;

ALTER TABLE public.course
  ALTER COLUMN course_category SET DEFAULT 'major-core',
  ALTER COLUMN course_category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_course_category'
  ) THEN
    ALTER TABLE public.course
      ADD CONSTRAINT check_course_category
      CHECK (course_category IN ('major-core', 'major-elective', 'ge'));
  END IF;
END $$;

COMMIT;
