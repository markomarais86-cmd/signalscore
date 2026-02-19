
-- Move ICPs back to Ninety One Life (child org) where they belong
UPDATE icp_profiles 
SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634' 
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
