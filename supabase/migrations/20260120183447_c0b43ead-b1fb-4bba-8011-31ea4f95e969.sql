-- Fix 1: Set security_invoker=true on enrichment_cost_summary view
DROP VIEW IF EXISTS enrichment_cost_summary;
CREATE VIEW enrichment_cost_summary 
WITH (security_invoker = true) AS
SELECT 
  enrichment_costs.org_id,
  date_trunc('day'::text, enrichment_costs.created_at) AS date,
  enrichment_costs.source,
  enrichment_costs.record_type,
  count(*) AS records_processed,
  sum(
    CASE
      WHEN enrichment_costs.success THEN 1
      ELSE 0
    END) AS successful,
  sum(enrichment_costs.cost_usd) AS total_cost,
  avg(enrichment_costs.cost_usd) AS avg_cost_per_record
FROM enrichment_costs
GROUP BY enrichment_costs.org_id, (date_trunc('day'::text, enrichment_costs.created_at)), enrichment_costs.source, enrichment_costs.record_type;

-- Fix 2: Add search_path to get_top_lead_titles function to prevent search path hijacking
CREATE OR REPLACE FUNCTION public.get_top_lead_titles(p_org_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(title text, count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT "Leads".title, COUNT(*) as count
  FROM "Leads"
  WHERE org_id = p_org_id AND title IS NOT NULL
  GROUP BY "Leads".title
  ORDER BY count DESC
  LIMIT p_limit;
$$;