-- Create API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  scopes text[] DEFAULT ARRAY['read']::text[],
  CONSTRAINT api_keys_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Enable RLS on api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_keys
CREATE POLICY "Admins can view API keys in their org"
  ON public.api_keys FOR SELECT
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can insert API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update API keys"
  ON public.api_keys FOR UPDATE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete API keys"
  ON public.api_keys FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Add foreign key constraints for data consistency
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_org_id_fkey,
  ADD CONSTRAINT contacts_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_org_id_fkey,
  ADD CONSTRAINT accounts_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.scores
  DROP CONSTRAINT IF EXISTS scores_org_id_fkey,
  ADD CONSTRAINT scores_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.icp_profiles
  DROP CONSTRAINT IF EXISTS icp_profiles_org_id_fkey,
  ADD CONSTRAINT icp_profiles_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public."Leads"
  DROP CONSTRAINT IF EXISTS leads_org_id_fkey,
  ADD CONSTRAINT leads_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.sync_jobs
  DROP CONSTRAINT IF EXISTS sync_jobs_org_id_fkey,
  ADD CONSTRAINT sync_jobs_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_org_id_fkey,
  ADD CONSTRAINT user_profiles_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.feature_flags
  DROP CONSTRAINT IF EXISTS feature_flags_org_id_fkey,
  ADD CONSTRAINT feature_flags_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.zapier_webhooks
  DROP CONSTRAINT IF EXISTS zapier_webhooks_org_id_fkey,
  ADD CONSTRAINT zapier_webhooks_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create triggers for Zapier webhooks
DROP TRIGGER IF EXISTS trigger_zapier_account_change ON public.accounts;
CREATE TRIGGER trigger_zapier_account_change
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION notify_zapier_account_change();

DROP TRIGGER IF EXISTS trigger_zapier_contact_change ON public.contacts;
CREATE TRIGGER trigger_zapier_contact_change
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_zapier_contact_change();

DROP TRIGGER IF EXISTS trigger_zapier_lead_change ON public."Leads";
CREATE TRIGGER trigger_zapier_lead_change
  AFTER INSERT ON public."Leads"
  FOR EACH ROW
  EXECUTE FUNCTION notify_zapier_lead_change();

DROP TRIGGER IF EXISTS trigger_zapier_score_change ON public.scores;
CREATE TRIGGER trigger_zapier_score_change
  AFTER INSERT OR UPDATE ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION notify_zapier_score_change();

-- Function to validate API key
CREATE OR REPLACE FUNCTION public.validate_api_key(key_to_validate text)
RETURNS TABLE (
  org_id uuid,
  scopes text[],
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_record RECORD;
BEGIN
  -- Hash the key and look it up
  SELECT ak.org_id, ak.scopes, ak.is_active, ak.expires_at
  INTO key_record
  FROM public.api_keys ak
  WHERE ak.key_hash = encode(digest(key_to_validate, 'sha256'), 'hex')
    AND ak.is_active = true;

  -- Check if key exists and is not expired
  IF key_record IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text[], false;
    RETURN;
  END IF;

  IF key_record.expires_at IS NOT NULL AND key_record.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text[], false;
    RETURN;
  END IF;

  -- Update last used timestamp
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE key_hash = encode(digest(key_to_validate, 'sha256'), 'hex');

  RETURN QUERY SELECT key_record.org_id, key_record.scopes, true;
END;
$$;