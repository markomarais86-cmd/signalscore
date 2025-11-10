-- Add Deep Research Enrichment Fields to Accounts Table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS naics TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tech_stack TEXT[];
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_funding_round TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_funding_date DATE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS total_raised_usd NUMERIC;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trust_signals JSONB;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS enrichment_confidence NUMERIC;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS enrichment_citations JSONB;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS enrichment_phase TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deep_research_requested BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deep_research_completed_at TIMESTAMP WITH TIME ZONE;

-- Add Deep Research Fields to Leads Table
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS phone_type TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS email_status TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS location_region TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS title_as_of DATE;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS enrichment_confidence NUMERIC;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS enrichment_citations JSONB;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS match_reasoning TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS deep_research_completed_at TIMESTAMP WITH TIME ZONE;

-- Create Deep Research Candidates Table
CREATE TABLE IF NOT EXISTS deep_research_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  lead_id BIGINT REFERENCES "Leads"(id),
  account_external_id TEXT,
  
  person_data JSONB,
  company_data JSONB,
  
  match_reasoning TEXT,
  confidence NUMERIC,
  citations JSONB,
  
  selected BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  dismissed_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_deep_candidates_org ON deep_research_candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_deep_candidates_lead ON deep_research_candidates(lead_id);
CREATE INDEX IF NOT EXISTS idx_deep_candidates_account ON deep_research_candidates(account_external_id);
CREATE INDEX IF NOT EXISTS idx_deep_candidates_selected ON deep_research_candidates(selected) WHERE selected = true;

-- Enable RLS
ALTER TABLE deep_research_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view candidates in their org" ON deep_research_candidates
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert candidates" ON deep_research_candidates
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update candidates" ON deep_research_candidates
  FOR UPDATE USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete candidates" ON deep_research_candidates
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());