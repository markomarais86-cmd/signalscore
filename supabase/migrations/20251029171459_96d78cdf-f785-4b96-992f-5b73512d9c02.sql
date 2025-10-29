-- Backfill existing scores with primary ICP reference
-- Links all historical scores (currently NULL icp_id) to the primary ICP
UPDATE public.scores
SET icp_id = 'd5c7eca2-66f9-4dd3-995d-e26fb8c3fe1d'
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
  AND icp_id IS NULL;