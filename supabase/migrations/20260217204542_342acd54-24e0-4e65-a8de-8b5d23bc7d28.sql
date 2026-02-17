
-- Create helper function that returns user's own org_id + parent org_id
CREATE OR REPLACE FUNCTION public.get_user_accessible_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
  UNION
  SELECT get_data_org_id(org_id) FROM user_profiles WHERE user_id = auth.uid()
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view custom attribute definitions for their org" ON custom_attribute_definitions;
DROP POLICY IF EXISTS "Users can create custom attribute definitions for their org" ON custom_attribute_definitions;
DROP POLICY IF EXISTS "Users can update custom attribute definitions for their org" ON custom_attribute_definitions;
DROP POLICY IF EXISTS "Users can delete custom attribute definitions for their org" ON custom_attribute_definitions;

-- Recreate with parent-org-aware check
CREATE POLICY "Users can view custom attribute definitions for their org"
ON custom_attribute_definitions FOR SELECT
USING (org_id IN (SELECT get_user_accessible_org_ids()));

CREATE POLICY "Users can create custom attribute definitions for their org"
ON custom_attribute_definitions FOR INSERT
WITH CHECK (org_id IN (SELECT get_user_accessible_org_ids()));

CREATE POLICY "Users can update custom attribute definitions for their org"
ON custom_attribute_definitions FOR UPDATE
USING (org_id IN (SELECT get_user_accessible_org_ids()));

CREATE POLICY "Users can delete custom attribute definitions for their org"
ON custom_attribute_definitions FOR DELETE
USING (org_id IN (SELECT get_user_accessible_org_ids()));
