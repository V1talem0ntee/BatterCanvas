BEGIN;

INSERT INTO public.ge_area (school_id, ge_area_code, ge_area_name, description)
SELECT school.school_id, area.code, area.name, area.description
FROM public.school school
CROSS JOIN (VALUES
  ('A', 'Area A', 'General Education Area A'),
  ('B', 'Area B', 'General Education Area B'),
  ('C', 'Area C', 'General Education Area C'),
  ('D', 'Area D', 'General Education Area D')
) AS area(code, name, description)
ON CONFLICT (school_id, ge_area_code) DO NOTHING;

COMMIT;
