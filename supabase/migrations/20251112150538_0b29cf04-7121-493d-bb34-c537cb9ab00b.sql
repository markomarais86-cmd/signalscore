-- Phase 0: Data Contract & Governance Foundation
-- Identity Registry (canonical contact/account mapping)
CREATE TABLE IF NOT EXISTS public.identity_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  contact_id BIGINT REFERENCES public."Leads"(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  primary_email TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  primary_domain TEXT,
  crm_object_type TEXT CHECK (crm_object_type IN ('lead', 'contact', 'account')),
  external_source_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email_hash)
);

-- Enable RLS
ALTER TABLE public.identity_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies for identity_registry
CREATE POLICY "Users can view identity records in their org"
  ON public.identity_registry FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert identity records"
  ON public.identity_registry FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update identity records"
  ON public.identity_registry FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete identity records"
  ON public.identity_registry FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes
CREATE INDEX idx_identity_registry_org_email ON public.identity_registry(org_id, email_hash);
CREATE INDEX idx_identity_registry_contact ON public.identity_registry(contact_id);
CREATE INDEX idx_identity_registry_account ON public.identity_registry(account_id);

-- Suppression Rules (global opt-out, DNC, exclusions)
CREATE TABLE IF NOT EXISTS public.suppression_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  email TEXT,
  domain TEXT,
  reason TEXT NOT NULL,
  suppression_type TEXT NOT NULL CHECK (suppression_type IN ('email', 'domain', 'phone')),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.suppression_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppression_rules
CREATE POLICY "Users can view suppression rules in their org"
  ON public.suppression_rules FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert suppression rules"
  ON public.suppression_rules FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update suppression rules"
  ON public.suppression_rules FOR UPDATE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete suppression rules"
  ON public.suppression_rules FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes
CREATE INDEX idx_suppression_rules_org_email ON public.suppression_rules(org_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_suppression_rules_org_domain ON public.suppression_rules(org_id, domain) WHERE domain IS NOT NULL;

-- Consent Registry (GDPR/privacy compliance)
CREATE TABLE IF NOT EXISTS public.consent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  contact_id BIGINT REFERENCES public."Leads"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  consent_given BOOLEAN DEFAULT false,
  consent_source TEXT,
  consent_timestamp TIMESTAMPTZ,
  legal_basis TEXT CHECK (legal_basis IN ('consent', 'contract', 'legitimate_interest')),
  opt_out_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consent_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consent_registry
CREATE POLICY "Users can view consent records in their org"
  ON public.consent_registry FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert consent records"
  ON public.consent_registry FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update consent records"
  ON public.consent_registry FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete consent records"
  ON public.consent_registry FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes
CREATE INDEX idx_consent_registry_org_email ON public.consent_registry(org_id, email);
CREATE INDEX idx_consent_registry_contact ON public.consent_registry(contact_id);

-- Verification Log (email/phone validation)
CREATE TABLE IF NOT EXISTS public.verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  contact_id BIGINT REFERENCES public."Leads"(id) ON DELETE CASCADE,
  verification_type TEXT CHECK (verification_type IN ('email', 'phone')),
  value_checked TEXT NOT NULL,
  status TEXT CHECK (status IN ('valid', 'invalid', 'risky', 'unknown')),
  confidence_score DECIMAL(5,2),
  provider TEXT,
  provider_response JSONB,
  verified_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification_log
CREATE POLICY "Users can view verification logs in their org"
  ON public.verification_log FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert verification logs"
  ON public.verification_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete verification logs"
  ON public.verification_log FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes
CREATE INDEX idx_verification_log_contact ON public.verification_log(contact_id);
CREATE INDEX idx_verification_log_org_type ON public.verification_log(org_id, verification_type);

-- Campaign Naming Registry (enforce naming standards)
CREATE TABLE IF NOT EXISTS public.campaign_naming_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  campaign_name TEXT NOT NULL,
  icp_segment TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  region TEXT NOT NULL,
  week_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, campaign_name)
);

-- Enable RLS
ALTER TABLE public.campaign_naming_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_naming_registry
CREATE POLICY "Users can view campaign names in their org"
  ON public.campaign_naming_registry FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert campaign names"
  ON public.campaign_naming_registry FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete campaign names"
  ON public.campaign_naming_registry FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Phase 1: Export Telemetry
CREATE TABLE IF NOT EXISTS public.lp_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  batch_id TEXT NOT NULL,
  export_type TEXT CHECK (export_type IN ('csv', 'crm_campaign', 'sep_sync')),
  filter_params JSONB NOT NULL,
  export_count INTEGER NOT NULL,
  eligible_count INTEGER,
  skipped_count INTEGER,
  skip_reasons JSONB,
  campaign_name TEXT,
  exported_by UUID,
  exported_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lp_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lp_exports
CREATE POLICY "Users can view exports in their org"
  ON public.lp_exports FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert exports"
  ON public.lp_exports FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete exports"
  ON public.lp_exports FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes
CREATE INDEX idx_lp_exports_org_batch ON public.lp_exports(org_id, batch_id);
CREATE INDEX idx_lp_exports_org_date ON public.lp_exports(org_id, exported_at DESC);

-- Extend Leads table with verification & consent flags
ALTER TABLE public."Leads"
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_status TEXT CHECK (email_verification_status IN ('valid', 'invalid', 'risky', 'unknown', 'pending')),
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verification_status TEXT CHECK (phone_verification_status IN ('valid', 'invalid', 'risky', 'unknown', 'pending')),
ADD COLUMN IF NOT EXISTS consent_status TEXT DEFAULT 'unknown' CHECK (consent_status IN ('given', 'not_given', 'opted_out', 'unknown')),
ADD COLUMN IF NOT EXISTS suppression_reason TEXT,
ADD COLUMN IF NOT EXISTS export_eligible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS priority_rank INTEGER,
ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lp_batch_id TEXT;

-- Create index for export eligibility queries
CREATE INDEX IF NOT EXISTS idx_leads_export_eligible ON public."Leads"(org_id, export_eligible, email_verified) WHERE export_eligible = true;