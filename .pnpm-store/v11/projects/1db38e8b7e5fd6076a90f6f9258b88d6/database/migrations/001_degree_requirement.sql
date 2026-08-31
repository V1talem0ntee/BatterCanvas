BEGIN;

ALTER TABLE public.degree_requirement
    ADD COLUMN IF NOT EXISTS completion_rule VARCHAR(20);

UPDATE public.degree_requirement
SET completion_rule = CASE
    WHEN requirement_type = 'major-core' THEN 'all-courses'
    ELSE 'minimum-units'
END
WHERE completion_rule IS NULL;

ALTER TABLE public.degree_requirement
    ALTER COLUMN completion_rule SET DEFAULT 'minimum-units',
    ALTER COLUMN completion_rule SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_degree_requirement_completion_rule'
    ) THEN
        ALTER TABLE public.degree_requirement
            ADD CONSTRAINT check_degree_requirement_completion_rule
            CHECK (completion_rule IN ('all-courses', 'minimum-units'));
    END IF;
END $$;

COMMIT;
