-- Add credits tracking to enrichment_jobs table
ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_remaining integer;

-- Add organization-level credits tracking
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS enrichment_credits_total integer DEFAULT 1000,
ADD COLUMN IF NOT EXISTS enrichment_credits_used integer DEFAULT 0;

-- Function to calculate remaining credits for an organization
CREATE OR REPLACE FUNCTION get_org_enrichment_credits(org_uuid uuid)
RETURNS TABLE (
  total integer,
  used integer,
  remaining integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(enrichment_credits_total, 1000) as total,
    COALESCE(enrichment_credits_used, 0) as used,
    COALESCE(enrichment_credits_total, 1000) - COALESCE(enrichment_credits_used, 0) as remaining
  FROM organizations
  WHERE id = org_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;