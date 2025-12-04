-- Backfill ALL accounts with firmographic data from linked leads
WITH lead_aggregates AS (
  SELECT 
    account_external_id,
    MODE() WITHIN GROUP (ORDER BY revenue_range) FILTER (WHERE revenue_range IS NOT NULL) as best_revenue,
    MODE() WITHIN GROUP (ORDER BY employee_count) FILTER (WHERE employee_count IS NOT NULL) as best_employee_count,
    MODE() WITHIN GROUP (ORDER BY country) FILTER (WHERE country IS NOT NULL) as best_country,
    MODE() WITHIN GROUP (ORDER BY industry) FILTER (WHERE industry IS NOT NULL) as best_industry,
    MODE() WITHIN GROUP (ORDER BY state_province) FILTER (WHERE state_province IS NOT NULL) as best_state
  FROM "Leads"
  WHERE account_external_id IS NOT NULL
    AND account_external_id != ''
  GROUP BY account_external_id
)
UPDATE accounts a
SET 
  revenue_range = COALESCE(a.revenue_range, la.best_revenue),
  employee_count = COALESCE(a.employee_count, la.best_employee_count),
  country = COALESCE(a.country, la.best_country),
  industry_raw = COALESCE(a.industry_raw, la.best_industry),
  state_province = COALESCE(a.state_province, la.best_state),
  updated_at = NOW()
FROM lead_aggregates la
WHERE a.external_id = la.account_external_id
  AND (
    (a.revenue_range IS NULL AND la.best_revenue IS NOT NULL) OR
    (a.employee_count IS NULL AND la.best_employee_count IS NOT NULL) OR
    (a.country IS NULL AND la.best_country IS NOT NULL) OR
    (a.industry_raw IS NULL AND la.best_industry IS NOT NULL) OR
    (a.state_province IS NULL AND la.best_state IS NOT NULL)
  );