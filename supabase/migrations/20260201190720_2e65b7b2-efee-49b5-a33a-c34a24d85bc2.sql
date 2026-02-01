-- Add new columns to plan_limits for ICP models, integrations, and history tracking
ALTER TABLE plan_limits 
ADD COLUMN IF NOT EXISTS max_icp_models integer,
ADD COLUMN IF NOT EXISTS max_integrations integer,
ADD COLUMN IF NOT EXISTS history_months integer DEFAULT 3;

-- Rename starter → pilot and update values
UPDATE plan_limits SET 
  plan_name = 'pilot',
  display_name = 'Pilot',
  max_accounts = 3000,
  max_users = 3,
  enrichment_credits_monthly = 500,
  max_icp_models = 1,
  max_integrations = 1,
  history_months = 3,
  sort_order = 2
WHERE plan_name = 'starter';

-- Update professional tier to match pricing page
UPDATE plan_limits SET
  enrichment_credits_monthly = 1000,
  max_users = 10,
  max_icp_models = 3,
  max_integrations = 2,
  history_months = 12,
  sort_order = 3
WHERE plan_name = 'professional';

-- Insert new growth tier
INSERT INTO plan_limits (plan_name, display_name, max_accounts, max_users, enrichment_credits_monthly, max_icp_models, max_integrations, history_months, features, sort_order, is_active)
VALUES ('growth', 'Growth', 30000, 25, 3000, 10, NULL, 24, 
  '{"basic_analytics":true,"basic_enrichment":true,"ai_enrichment":true,"pipeline_analytics":true,"crm_sync":true,"deep_research":true,"alerts":true,"benchmarking":true,"sub_industry":true,"multi_region":true}',
  4, true)
ON CONFLICT (plan_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  max_accounts = EXCLUDED.max_accounts,
  max_users = EXCLUDED.max_users,
  enrichment_credits_monthly = EXCLUDED.enrichment_credits_monthly,
  max_icp_models = EXCLUDED.max_icp_models,
  max_integrations = EXCLUDED.max_integrations,
  history_months = EXCLUDED.history_months,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Update enterprise tier
UPDATE plan_limits SET
  max_icp_models = NULL,
  max_integrations = NULL,
  history_months = NULL,
  sort_order = 5
WHERE plan_name = 'enterprise';

-- Update free tier sort order
UPDATE plan_limits SET 
  sort_order = 1,
  max_icp_models = 1,
  max_integrations = 0,
  history_months = 1
WHERE plan_name = 'free';