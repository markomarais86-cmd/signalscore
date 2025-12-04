-- Fix scoring: set intent baseline to 50 and recalculate overall with adaptive weights

-- Update intent to 50 where missing
UPDATE scores
SET intent = 50
WHERE (intent IS NULL OR intent = 0)
  AND org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';

-- Recalculate overall using adaptive formula (70% fit, 10% intent, 20% reach when intent=50)
UPDATE scores
SET 
  overall = ROUND((COALESCE(fit, 50) * 0.70) + (COALESCE(intent, 50) * 0.10) + (COALESCE(reachability, 50) * 0.20)),
  scoring_version = 'adaptive_v3.1',
  computed_at = now()
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
  AND intent <= 50;