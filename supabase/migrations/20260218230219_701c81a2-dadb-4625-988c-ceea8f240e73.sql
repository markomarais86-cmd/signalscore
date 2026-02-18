
-- Step 1: Move user_profiles and ICP to correct org
UPDATE user_profiles SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE icp_profiles SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE bulk_scoring_jobs SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE campaign_snapshots SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE deals SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE campaigns SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE segments SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE account_segments SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE activities SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE automation_settings SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE account_signals SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE account_insights SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE auto_score_failures SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
UPDATE ai_agents SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
