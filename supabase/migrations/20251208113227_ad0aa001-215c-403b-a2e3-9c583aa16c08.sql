-- Fix vigansejdiu95@gmail.com's account: move to correct org
UPDATE user_profiles 
SET org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
WHERE user_id = 'd9df63c5-3e08-4415-ab5c-ae31419c5787';

-- Mark invitation as accepted
UPDATE invitations 
SET status = 'accepted', accepted_at = NOW()
WHERE email = 'vigansejdiu95@gmail.com' 
AND org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';

-- Delete orphaned organization that was auto-created
DELETE FROM organizations WHERE id = 'a1bb925a-4e99-4a6e-947a-d6872f51c4c9';