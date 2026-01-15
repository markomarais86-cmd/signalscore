
-- Create leads_summary view with actual column names from table
DROP VIEW IF EXISTS leads_summary;
CREATE VIEW public.leads_summary
WITH (security_invoker = on) AS
SELECT
  id,
  org_id,
  name,
  first_name,
  last_name,
  company,
  title,
  industry,
  status,
  pipeline_stage,
  icp_qualified,
  priority_rank,
  created_at,
  updated_at,
  account_external_id,
  data_source,
  persona,
  level,
  country,
  state_province,
  location_city,
  location_region,
  revenue_range,
  employee_count
  -- Excludes sensitive PII: email, phone, mobile, direct_phone, cell_phone, linkedin_url, etc.
FROM "Leads";

COMMENT ON VIEW public.leads_summary IS 'Sanitized view of Leads table excluding sensitive PII fields. Use for listing/dashboard views.';
