
-- Add org_settings JSONB column to organizations table for persisting deal size, conversion rate, etc.
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS org_settings JSONB DEFAULT '{}';

-- Allow users to read/update their own org settings
CREATE POLICY "Users can read own org settings"
ON public.organizations
FOR SELECT
USING (id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- Update policy for org settings
CREATE POLICY "Users can update own org settings"
ON public.organizations
FOR UPDATE
USING (id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));
