-- Fix deal_stage_history UPDATE policy
-- Drop the permissive policy if it exists
DROP POLICY IF EXISTS "System can update deal history" ON public.deal_stage_history;

-- Also drop the policy we tried to create before in case it exists with issues
DROP POLICY IF EXISTS "Users can update deal history in their org" ON public.deal_stage_history;

-- Create the proper org-scoped UPDATE policy
CREATE POLICY "Users can update deal history in their org"
  ON public.deal_stage_history
  FOR UPDATE
  TO authenticated
  USING (org_id = get_current_user_org_id());