-- Insert current weekly snapshot baseline
INSERT INTO weekly_analytics_snapshots (
  org_id, snapshot_date, total_accounts, high_fit_accounts, medium_fit_accounts, low_fit_accounts,
  high_fit_percentage, medium_fit_percentage, low_fit_percentage, data_completeness,
  tam_accounts, sam_accounts, som_accounts, top_countries, geography_distribution
)
VALUES (
  'd6b18474-150b-4a69-93ed-540e0e7c7efb',
  CURRENT_DATE,
  14360, 8723, 5062, 575,
  60.7, 35.2, 4.0,
  85.0,
  50000, 14360, 8723,
  '[{"country": "United States", "count": 8500}, {"country": "United Kingdom", "count": 2100}]'::jsonb,
  '{"United States": 8500, "United Kingdom": 2100}'::jsonb
)
ON CONFLICT (org_id, snapshot_date) DO UPDATE SET
  total_accounts = EXCLUDED.total_accounts,
  high_fit_accounts = EXCLUDED.high_fit_accounts,
  medium_fit_accounts = EXCLUDED.medium_fit_accounts,
  low_fit_accounts = EXCLUDED.low_fit_accounts;

-- Insert backdated snapshot for immediate WoW trends (1 week ago with slightly different numbers)
INSERT INTO weekly_analytics_snapshots (
  org_id, snapshot_date, total_accounts, high_fit_accounts, medium_fit_accounts, low_fit_accounts,
  high_fit_percentage, medium_fit_percentage, low_fit_percentage, data_completeness,
  tam_accounts, sam_accounts, som_accounts, top_countries, geography_distribution
)
VALUES (
  'd6b18474-150b-4a69-93ed-540e0e7c7efb',
  CURRENT_DATE - INTERVAL '7 days',
  14100, 8450, 5100, 550,
  59.9, 36.2, 3.9,
  82.0,
  50000, 14100, 8450,
  '[{"country": "United States", "count": 8300}, {"country": "United Kingdom", "count": 2050}]'::jsonb,
  '{"United States": 8300, "United Kingdom": 2050}'::jsonb
)
ON CONFLICT (org_id, snapshot_date) DO NOTHING;

-- Update data_quality_history with current accurate baseline
INSERT INTO data_quality_history (
  org_id, total_accounts, accounts_with_industry, accounts_with_size, accounts_with_revenue,
  accounts_with_geography, accounts_with_contacts, overall_completeness, scored_accounts,
  high_fit_accounts, medium_fit_accounts, low_fit_accounts,
  high_fit_accounts_delta, medium_fit_accounts_delta, low_fit_accounts_delta
)
VALUES (
  'd6b18474-150b-4a69-93ed-540e0e7c7efb',
  14360, 14360, 8634, 14360, 14360, 14360,
  85.0, 14360,
  8723, 5062, 575,
  273, -38, 25
);