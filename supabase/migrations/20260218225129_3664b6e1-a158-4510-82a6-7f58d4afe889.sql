-- Remove Insurance from ICP industries and add to excluded_industries
-- Narrow revenue ranges to enterprise focus ($100M+)
UPDATE icp_profiles 
SET 
  industries = ARRAY['Healthcare', 'Hospital & Health Systems', 'Medical Devices', 'Health IT', 'Hospitals & Physicians Clinics', 'Healthcare Services'],
  excluded_industries = ARRAY['Insurance', 'Property & Casualty Insurance', 'Life Insurance', 'Health Insurance'],
  revenue_ranges = ARRAY['$100M-$250M', '$250M-$500M', '$500M-$1B', '$1B-$5B', '$5B+'],
  version = version + 1,
  version_notes = 'Removed Insurance from industries (added to excluded). Narrowed revenue ranges to $100M+ to match enterprise ICP focus. Segment-weighted scoring redesign.'
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';