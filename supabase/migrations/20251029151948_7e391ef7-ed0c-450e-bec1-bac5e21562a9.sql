-- Step 1: Grant super_admin role to contact@launchpulse.io
INSERT INTO public.user_roles (user_id, role)
VALUES ('1ef01700-f007-4a71-8ecf-232842873b10', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 2: Move contact@launchpulse.io to "Marko Marais's Organization"
UPDATE public.user_profiles
SET org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
WHERE user_id = '1ef01700-f007-4a71-8ecf-232842873b10';

-- Step 3: Rename "Marko Marais's Organization" to "Launchpulse"
UPDATE public.organizations
SET name = 'Launchpulse'
WHERE id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';

-- Step 4: Delete the empty "Marko" organization
DELETE FROM public.organizations
WHERE id = '6dacf62c-e10a-4fd4-8611-1a0d5772f339';

-- Step 5: Create audit log entries for tracking
INSERT INTO public.audit_logs (org_id, actor, action, meta)
VALUES 
  ('726a0dc0-99c7-43c2-b20f-b849f2760c3f', 'contact@launchpulse.io', 'granted_super_admin', '{"user": "contact@launchpulse.io"}'::jsonb),
  ('726a0dc0-99c7-43c2-b20f-b849f2760c3f', 'system', 'organization_renamed', '{"old_name": "Marko Marais''s Organization", "new_name": "Launchpulse"}'::jsonb);