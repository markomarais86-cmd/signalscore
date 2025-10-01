-- Add missing fields to icp_profiles table
ALTER TABLE public.icp_profiles
ADD COLUMN IF NOT EXISTS tech_stack text[],
ADD COLUMN IF NOT EXISTS buying_signals text[],
ADD COLUMN IF NOT EXISTS budget_indicators text[],
ADD COLUMN IF NOT EXISTS decision_process text,
ADD COLUMN IF NOT EXISTS competitive_landscape text[],
ADD COLUMN IF NOT EXISTS pain_points text[];

-- Update existing ICP profiles to ensure they have all arrays initialized
UPDATE public.icp_profiles
SET 
  tech_stack = COALESCE(tech_stack, ARRAY[]::text[]),
  buying_signals = COALESCE(buying_signals, ARRAY[]::text[]),
  budget_indicators = COALESCE(budget_indicators, ARRAY[]::text[]),
  competitive_landscape = COALESCE(competitive_landscape, ARRAY[]::text[]),
  pain_points = COALESCE(pain_points, ARRAY[]::text[])
WHERE tech_stack IS NULL 
   OR buying_signals IS NULL 
   OR budget_indicators IS NULL 
   OR competitive_landscape IS NULL 
   OR pain_points IS NULL;

COMMENT ON COLUMN public.icp_profiles.tech_stack IS 'Technology stack used by ideal customers';
COMMENT ON COLUMN public.icp_profiles.buying_signals IS 'Key buying signals indicating purchase intent';
COMMENT ON COLUMN public.icp_profiles.budget_indicators IS 'Indicators of budget availability';
COMMENT ON COLUMN public.icp_profiles.decision_process IS 'Typical decision-making process description';
COMMENT ON COLUMN public.icp_profiles.competitive_landscape IS 'Competitive solutions in use';
COMMENT ON COLUMN public.icp_profiles.pain_points IS 'Key pain points addressed by solution';