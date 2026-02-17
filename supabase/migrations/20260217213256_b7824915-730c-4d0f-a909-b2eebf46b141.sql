-- Update external_data_sources SELECT policy to allow parent org users to read child org data
DROP POLICY IF EXISTS "Users can view their own external data sources" ON public.external_data_sources;

CREATE POLICY "Users can view own and child org external data sources"
ON public.external_data_sources
FOR SELECT
USING (
  org_id = get_current_user_org_id()
  OR org_id IN (SELECT id FROM public.organizations WHERE parent_org_id = get_current_user_org_id())
);