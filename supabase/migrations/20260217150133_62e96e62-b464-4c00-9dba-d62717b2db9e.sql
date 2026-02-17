
-- Drop the old uuid overload that causes ambiguity
DROP FUNCTION IF EXISTS public.get_enriched_leads_metrics(uuid);
