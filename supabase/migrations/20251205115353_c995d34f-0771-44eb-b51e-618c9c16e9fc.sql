-- Add credit tracking columns to external_data_sources
ALTER TABLE public.external_data_sources 
ADD COLUMN IF NOT EXISTS credits_remaining bigint DEFAULT NULL,
ADD COLUMN IF NOT EXISTS credits_used_total bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_last_checked timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monthly_credit_limit bigint DEFAULT NULL;

-- Create Apollo redemption log table
CREATE TABLE IF NOT EXISTS public.apollo_redemption_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  credits_used integer NOT NULL DEFAULT 0,
  contacts_redeemed integer NOT NULL DEFAULT 0,
  contacts_skipped_duplicate integer NOT NULL DEFAULT 0,
  persona_filters jsonb DEFAULT NULL,
  account_filters jsonb DEFAULT NULL,
  campaign_name text DEFAULT NULL,
  source_accounts text[] DEFAULT NULL,
  redeemed_emails text[] DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.apollo_redemption_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for apollo_redemption_log
CREATE POLICY "Users can view their org's redemption logs"
ON public.apollo_redemption_log
FOR SELECT
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert redemption logs for their org"
ON public.apollo_redemption_log
FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_apollo_redemption_log_org_id ON public.apollo_redemption_log(org_id);
CREATE INDEX IF NOT EXISTS idx_apollo_redemption_log_redeemed_at ON public.apollo_redemption_log(redeemed_at DESC);