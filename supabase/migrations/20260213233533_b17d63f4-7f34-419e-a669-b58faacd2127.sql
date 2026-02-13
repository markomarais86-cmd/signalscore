
-- Step 1: Delete the incorrect Financial Services ICP
DELETE FROM icp_profiles WHERE id = '207c6c62-9d9d-4ba8-af1c-f997066baa01';

-- Step 2: Insert onboarding config with healthcare context
INSERT INTO org_onboarding_config (org_id, value_proposition, target_persona_description)
VALUES (
  'cd592f73-3e0e-478d-905b-47fe7c5fb634',
  'Health and longevity platform helping employers reduce healthcare costs through preventive wellness programs',
  'CPO, VP HR, Benefits Manager, Wellness Director at mid-to-large employers in Healthcare, Insurance, and Corporate Wellness'
)
ON CONFLICT (org_id) DO UPDATE SET
  value_proposition = EXCLUDED.value_proposition,
  target_persona_description = EXCLUDED.target_persona_description;
