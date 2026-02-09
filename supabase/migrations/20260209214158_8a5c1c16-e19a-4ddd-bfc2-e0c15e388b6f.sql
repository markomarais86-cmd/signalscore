-- Fix: Restrict public ICP templates to authenticated users only
-- Previously: anyone (including anonymous) could read templates where is_public = true
-- Now: only authenticated users can read public templates

DROP POLICY "Public templates are viewable by everyone" ON public.icp_templates;

CREATE POLICY "Authenticated users can view public templates"
ON public.icp_templates
FOR SELECT
TO authenticated
USING (is_public = true);