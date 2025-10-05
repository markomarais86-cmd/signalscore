-- Add match_confidence column to Leads table
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(3,2) DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_match_confidence 
ON public."Leads"(org_id, match_confidence);

-- Create fuzzy matching function
CREATE OR REPLACE FUNCTION public.match_leads_fuzzy(
  p_org_id UUID,
  p_base_domain TEXT,
  p_company_name TEXT,
  p_country TEXT DEFAULT NULL
)
RETURNS TABLE(account_external_id TEXT, confidence NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return potential account matches with confidence scores
  RETURN QUERY
  WITH normalized_accounts AS (
    SELECT 
      a.external_id,
      a.domain,
      a.name,
      a.country,
      -- Extract base domain (first part before dash or dot)
      LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(a.domain, '\.[^.]+$', ''), -- Remove TLD
        '-.*$', '' -- Remove everything after first dash
      )) as base_domain,
      -- Normalize company name
      LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(a.name, '\s+(inc|llc|ltd|corp|corporation|limited|gmbh|ag|sa|nv|bv|plc)\.?$', '', 'i'),
        '[^a-z0-9\s]', '', 'g'
      )) as normalized_name
    FROM public.accounts a
    WHERE a.org_id = p_org_id
      AND (a.domain IS NOT NULL OR a.name IS NOT NULL)
  )
  SELECT DISTINCT ON (na.external_id)
    na.external_id,
    CASE
      -- Base domain + country match = 0.9
      WHEN na.base_domain = p_base_domain 
        AND p_country IS NOT NULL 
        AND LOWER(na.country) = LOWER(p_country) THEN 0.90
      
      -- Company name + country match = 0.85
      WHEN na.normalized_name = LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(p_company_name, '\s+(inc|llc|ltd|corp|corporation|limited|gmbh|ag|sa|nv|bv|plc)\.?$', '', 'i'),
        '[^a-z0-9\s]', '', 'g'
      ))
        AND p_country IS NOT NULL
        AND LOWER(na.country) = LOWER(p_country) THEN 0.85
      
      -- Base domain only match = 0.75
      WHEN na.base_domain = p_base_domain THEN 0.75
      
      -- Company name only match = 0.70
      WHEN na.normalized_name = LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(p_company_name, '\s+(inc|llc|ltd|corp|corporation|limited|gmbh|ag|sa|nv|bv|plc)\.?$', '', 'i'),
        '[^a-z0-9\s]', '', 'g'
      )) THEN 0.70
      
      ELSE 0.50
    END as confidence
  FROM normalized_accounts na
  WHERE (
    -- Base domain match
    na.base_domain = p_base_domain
    OR 
    -- Normalized company name match
    na.normalized_name = LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(p_company_name, '\s+(inc|llc|ltd|corp|corporation|limited|gmbh|ag|sa|nv|bv|plc)\.?$', '', 'i'),
      '[^a-z0-9\s]', '', 'g'
    ))
  )
  ORDER BY na.external_id, confidence DESC;
END;
$function$;