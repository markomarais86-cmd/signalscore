-- Add persona mapping trigger to Leads table
CREATE TRIGGER map_lead_persona_on_insert_update
  BEFORE INSERT OR UPDATE OF title ON "Leads"
  FOR EACH ROW
  EXECUTE FUNCTION public.map_lead_persona();

-- Update get_persona_drilldown to use Leads instead of contacts
CREATE OR REPLACE FUNCTION public.get_persona_drilldown(p_org_id uuid, p_industry text, p_country text)
RETURNS TABLE(id text, name text, contact_count bigint, account_count bigint, avg_score numeric, coverage_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_accounts bigint;
BEGIN
  -- Get total accounts for coverage calculation
  SELECT COUNT(*) INTO total_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (p_industry = 'all' OR a.industry_norm = p_industry)
    AND (p_country = 'all' OR a.country = p_country);

  RETURN QUERY
  SELECT 
    COALESCE(l.persona, 'Unknown') as id,
    COALESCE(l.persona, 'Unknown') as name,
    COUNT(*) as contact_count,
    COUNT(DISTINCT l.account_external_id) as account_count,
    ROUND(AVG(s.overall)) as avg_score,
    CASE WHEN total_accounts > 0 
      THEN ROUND((COUNT(DISTINCT l.account_external_id)::numeric / total_accounts * 100)::numeric, 1)
      ELSE 0 
    END as coverage_rate
  FROM "Leads" l
  LEFT JOIN accounts a ON a.external_id = l.account_external_id AND a.org_id = l.org_id
  LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND (p_industry = 'all' OR a.industry_norm = p_industry)
    AND (p_country = 'all' OR a.country = p_country)
    AND l.persona IS NOT NULL
  GROUP BY l.persona
  HAVING COUNT(*) > 0
  ORDER BY contact_count DESC;
END;
$function$;

-- Backfill personas for any leads that have titles but no persona
UPDATE "Leads"
SET persona = public.map_title_to_persona(title)
WHERE title IS NOT NULL 
  AND (persona IS NULL OR persona = '');