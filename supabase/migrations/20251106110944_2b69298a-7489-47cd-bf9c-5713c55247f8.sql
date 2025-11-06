-- Phase 1: Add missing enrichment fields to Leads table
ALTER TABLE "Leads" 
ADD COLUMN IF NOT EXISTS title_raw text,
ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'crm',
ADD COLUMN IF NOT EXISTS level text,
ADD COLUMN IF NOT EXISTS enriched_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS enriched_from text,
ADD COLUMN IF NOT EXISTS external_database_match boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add index for campaign ready queries
CREATE INDEX IF NOT EXISTS idx_leads_campaign_ready 
ON "Leads" (org_id, email, persona) 
WHERE email IS NOT NULL AND persona IS NOT NULL AND persona != 'Unknown';

-- Phase 2: Migrate contacts data into Leads
-- Only migrate contacts that don't already exist as leads (based on email + org_id)
INSERT INTO "Leads" (
  org_id,
  external_id,
  account_external_id,
  first_name,
  last_name,
  email,
  phone,
  mobile,
  title,
  title_raw,
  persona,
  level,
  country,
  state_province,
  data_source,
  enriched_at,
  enriched_from,
  external_database_match,
  status
)
SELECT 
  c.org_id,
  'MIGRATED_' || c.external_id as external_id,
  c.account_external_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.mobile,
  c.title_raw as title,
  c.title_raw,
  c.persona,
  c.level,
  c.country,
  c.state_province,
  c.data_source,
  c.enriched_at,
  c.enriched_from,
  c.external_database_match,
  'open' as status
FROM contacts c
WHERE NOT EXISTS (
  SELECT 1 FROM "Leads" l 
  WHERE l.email = c.email 
  AND l.org_id = c.org_id
)
AND c.email IS NOT NULL;

-- Phase 3: Update existing Leads with enrichment data from contacts (where email matches)
UPDATE "Leads" l
SET 
  title_raw = COALESCE(l.title_raw, c.title_raw),
  enriched_at = COALESCE(l.enriched_at, c.enriched_at),
  enriched_from = COALESCE(l.enriched_from, c.enriched_from),
  persona = COALESCE(l.persona, c.persona),
  level = COALESCE(l.level, c.level),
  data_source = CASE 
    WHEN l.data_source = 'crm' AND c.data_source = 'database' THEN 'both'
    ELSE COALESCE(l.data_source, c.data_source)
  END,
  external_database_match = l.external_database_match OR c.external_database_match
FROM contacts c
WHERE l.email = c.email 
AND l.org_id = c.org_id
AND c.email IS NOT NULL;

-- Phase 4: Create helper function for campaign ready leads
CREATE OR REPLACE FUNCTION is_lead_campaign_ready(
  p_email text,
  p_title text,
  p_persona text
) RETURNS boolean AS $$
BEGIN
  RETURN (
    p_email IS NOT NULL 
    AND p_email LIKE '%@%'
    AND p_title IS NOT NULL
    AND p_title != ''
    AND p_persona IS NOT NULL
    AND p_persona != 'Unknown'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Phase 5: Update count functions to use Leads only
CREATE OR REPLACE FUNCTION count_campaign_ready_leads(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Count leads linked to high-fit accounts with valid email and persona
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND s.overall >= 70
    AND is_lead_campaign_ready(l.email, l.title, l.persona);
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION count_campaign_ready_accounts(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Count high-fit accounts that have at least one campaign-ready lead
  SELECT COUNT(DISTINCT a.external_id)::integer INTO v_count
  FROM accounts a
  INNER JOIN scores s ON a.external_id = s.account_external_id
  INNER JOIN "Leads" l ON a.external_id = l.account_external_id
  WHERE a.org_id = p_org_id
    AND s.org_id = p_org_id
    AND l.org_id = p_org_id
    AND s.overall >= 70
    AND is_lead_campaign_ready(l.email, l.title, l.persona);
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Phase 6: Add trigger to auto-update updated_at on Leads
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at_trigger ON "Leads";
CREATE TRIGGER leads_updated_at_trigger
BEFORE UPDATE ON "Leads"
FOR EACH ROW
EXECUTE FUNCTION update_leads_updated_at();

-- Phase 7: Drop contacts table and related objects
DROP TABLE IF EXISTS contacts CASCADE;