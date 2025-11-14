-- Drop the timestamp-based version of get_filtered_accounts to resolve function overloading conflict
-- This leaves only the text-based cursor version which is used by the frontend
DROP FUNCTION IF EXISTS public.get_filtered_accounts(
  p_org_id uuid, 
  p_cursor timestamp with time zone,
  p_limit integer,
  p_search_term text,
  p_industry text,
  p_country text,
  p_data_source text,
  p_fit_min integer,
  p_fit_max integer,
  p_campaign_ready boolean
);