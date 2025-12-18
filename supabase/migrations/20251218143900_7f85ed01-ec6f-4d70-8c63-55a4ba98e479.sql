-- Phase 1: Database Schema Completion
-- Add account_merge_log table for tracking merge history
CREATE TABLE IF NOT EXISTS public.account_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  old_account_external_id TEXT NOT NULL,
  new_account_external_id TEXT NOT NULL,
  merged_by UUID,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merge_details JSONB DEFAULT '{}'::jsonb,
  old_account_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add last_verified_at column to accounts for data quality tracking
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Add pipeline_metrics_cache table for caching computed metrics
CREATE TABLE IF NOT EXISTS public.pipeline_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  UNIQUE(org_id, date_range_start, date_range_end, filters)
);

-- Phase 2: GDPR Compliance - DSAR requests table
CREATE TABLE IF NOT EXISTS public.dsar_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete', 'access', 'rectification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  request_details JSONB DEFAULT '{}'::jsonb,
  result_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 4: Alerts table for notification system
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('velocity_drop', 'win_rate_decline', 'slippage_increase', 'pipeline_threshold', 'deal_at_risk', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  threshold_value NUMERIC,
  threshold_operator TEXT CHECK (threshold_operator IN ('gt', 'lt', 'eq', 'gte', 'lte')),
  comparison_period TEXT DEFAULT '7d',
  notification_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  webhook_url TEXT,
  slack_webhook_url TEXT,
  email_recipients TEXT[],
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 6: Plan limits table
CREATE TABLE IF NOT EXISTS public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  max_accounts INTEGER,
  max_leads INTEGER,
  max_users INTEGER,
  enrichment_credits_monthly INTEGER,
  api_calls_monthly INTEGER,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization plan assignment
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plan_limits(id);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS enrichment_credits_used INTEGER DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS enrichment_credits_reset_at TIMESTAMPTZ DEFAULT now();

-- Alert history table for tracking triggered alerts
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_value NUMERIC,
  threshold_value NUMERIC,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_channels TEXT[],
  notification_error TEXT,
  context_data JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on all new tables
ALTER TABLE public.account_merge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsar_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_merge_log
CREATE POLICY "Users can view their org merge logs"
  ON public.account_merge_log FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert merge logs for their org"
  ON public.account_merge_log FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- RLS Policies for pipeline_metrics_cache
CREATE POLICY "Users can view their org metrics cache"
  ON public.pipeline_metrics_cache FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their org metrics cache"
  ON public.pipeline_metrics_cache FOR ALL
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- RLS Policies for dsar_requests
CREATE POLICY "Users can view their own DSAR requests"
  ON public.dsar_requests FOR SELECT
  USING (user_id = auth.uid() OR org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create their own DSAR requests"
  ON public.dsar_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for alerts
CREATE POLICY "Users can view their org alerts"
  ON public.alerts FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their org alerts"
  ON public.alerts FOR ALL
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- RLS Policies for plan_limits (public read)
CREATE POLICY "Anyone can view plan limits"
  ON public.plan_limits FOR SELECT
  USING (true);

-- RLS Policies for alert_history
CREATE POLICY "Users can view their org alert history"
  ON public.alert_history FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_merge_log_org_id ON public.account_merge_log(org_id);
CREATE INDEX IF NOT EXISTS idx_account_merge_log_merged_at ON public.account_merge_log(merged_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_cache_org_dates ON public.pipeline_metrics_cache(org_id, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_cache_expires ON public.pipeline_metrics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_org_id ON public.dsar_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_user_id ON public.dsar_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_status ON public.dsar_requests(status);
CREATE INDEX IF NOT EXISTS idx_alerts_org_id ON public.alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON public.alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON public.alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON public.alert_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_last_verified_at ON public.accounts(last_verified_at);

-- Insert default plan limits
INSERT INTO public.plan_limits (plan_name, display_name, max_accounts, max_leads, max_users, enrichment_credits_monthly, api_calls_monthly, features, sort_order)
VALUES 
  ('free', 'Free', 100, 500, 2, 50, 1000, '{"basic_enrichment": true, "csv_import": true, "basic_analytics": true}'::jsonb, 1),
  ('starter', 'Starter', 1000, 5000, 5, 500, 10000, '{"basic_enrichment": true, "ai_enrichment": true, "csv_import": true, "crm_sync": true, "basic_analytics": true, "pipeline_analytics": true}'::jsonb, 2),
  ('professional', 'Professional', 10000, 50000, 20, 5000, 100000, '{"basic_enrichment": true, "ai_enrichment": true, "deep_research": true, "csv_import": true, "crm_sync": true, "basic_analytics": true, "pipeline_analytics": true, "alerts": true, "api_access": true}'::jsonb, 3),
  ('enterprise', 'Enterprise', NULL, NULL, NULL, NULL, NULL, '{"basic_enrichment": true, "ai_enrichment": true, "deep_research": true, "csv_import": true, "crm_sync": true, "basic_analytics": true, "pipeline_analytics": true, "alerts": true, "api_access": true, "custom_integrations": true, "sso": true, "audit_logs": true}'::jsonb, 4)
ON CONFLICT (plan_name) DO NOTHING;

-- GDPR Functions
-- Function to export user data
CREATE OR REPLACE FUNCTION public.gdpr_export_user_data(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  user_org_id UUID;
BEGIN
  -- Get user's org_id
  SELECT org_id INTO user_org_id FROM user_profiles WHERE id = target_user_id;
  
  -- Compile all user data
  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(p.*) FROM user_profiles p WHERE p.id = target_user_id),
    'organizations', (SELECT jsonb_agg(row_to_json(o.*)) FROM organizations o WHERE o.id = user_org_id),
    'ai_memory', (SELECT jsonb_agg(row_to_json(m.*)) FROM ai_memory m WHERE m.user_id = target_user_id::text),
    'ai_workflows', (SELECT jsonb_agg(row_to_json(w.*)) FROM ai_workflows w WHERE w.user_id = target_user_id::text),
    'audit_logs', (SELECT jsonb_agg(row_to_json(a.*)) FROM audit_logs a WHERE a.actor = target_user_id::text AND a.org_id = user_org_id),
    'export_timestamp', now(),
    'export_version', '1.0'
  ) INTO result;
  
  -- Log the export request
  INSERT INTO dsar_requests (org_id, user_id, request_type, status, completed_at, result_data)
  VALUES (user_org_id, target_user_id, 'export', 'completed', now(), result);
  
  RETURN result;
END;
$$;

-- Function to anonymize/delete user data
CREATE OR REPLACE FUNCTION public.gdpr_delete_user_data(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id UUID;
  deletion_summary JSONB;
  affected_rows INTEGER;
BEGIN
  -- Get user's org_id
  SELECT org_id INTO user_org_id FROM user_profiles WHERE id = target_user_id;
  
  -- Start building deletion summary
  deletion_summary := jsonb_build_object('user_id', target_user_id, 'org_id', user_org_id, 'deleted_at', now());
  
  -- Anonymize AI memory
  UPDATE ai_memory SET 
    memory_value = '{"anonymized": true}'::jsonb,
    updated_at = now()
  WHERE user_id = target_user_id::text;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  deletion_summary := deletion_summary || jsonb_build_object('ai_memory_anonymized', affected_rows);
  
  -- Anonymize AI workflows
  UPDATE ai_workflows SET 
    context = '{"anonymized": true}'::jsonb,
    step_outputs = '{"anonymized": true}'::jsonb
  WHERE user_id = target_user_id::text;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  deletion_summary := deletion_summary || jsonb_build_object('ai_workflows_anonymized', affected_rows);
  
  -- Anonymize audit logs (keep for compliance but anonymize actor)
  UPDATE audit_logs SET 
    actor = 'anonymized-' || substring(target_user_id::text, 1, 8),
    meta = meta || '{"anonymized": true}'::jsonb
  WHERE actor = target_user_id::text;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  deletion_summary := deletion_summary || jsonb_build_object('audit_logs_anonymized', affected_rows);
  
  -- Anonymize user profile (keep record but remove PII)
  UPDATE user_profiles SET
    first_name = 'Deleted',
    last_name = 'User',
    avatar_url = NULL,
    updated_at = now()
  WHERE id = target_user_id;
  
  -- Log the deletion request
  INSERT INTO dsar_requests (org_id, user_id, request_type, status, completed_at, result_data)
  VALUES (user_org_id, target_user_id, 'delete', 'completed', now(), deletion_summary);
  
  RETURN deletion_summary;
END;
$$;

-- Function to check plan limits
CREATE OR REPLACE FUNCTION public.check_plan_limit(
  p_org_id UUID,
  p_limit_type TEXT,
  p_requested_amount INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_plan_id UUID;
  plan_record RECORD;
  current_count INTEGER;
  limit_value INTEGER;
  result JSONB;
BEGIN
  -- Get org's plan
  SELECT plan_id INTO org_plan_id FROM organizations WHERE id = p_org_id;
  
  -- If no plan, use free tier
  IF org_plan_id IS NULL THEN
    SELECT * INTO plan_record FROM plan_limits WHERE plan_name = 'free';
  ELSE
    SELECT * INTO plan_record FROM plan_limits WHERE id = org_plan_id;
  END IF;
  
  -- Get the limit value based on type
  CASE p_limit_type
    WHEN 'accounts' THEN
      limit_value := plan_record.max_accounts;
      SELECT COUNT(*) INTO current_count FROM accounts WHERE org_id = p_org_id;
    WHEN 'leads' THEN
      limit_value := plan_record.max_leads;
      SELECT COUNT(*) INTO current_count FROM "Leads" WHERE org_id = p_org_id;
    WHEN 'enrichment_credits' THEN
      limit_value := plan_record.enrichment_credits_monthly;
      SELECT enrichment_credits_used INTO current_count FROM organizations WHERE id = p_org_id;
    ELSE
      RETURN jsonb_build_object('allowed', true, 'error', 'Unknown limit type');
  END CASE;
  
  -- NULL means unlimited
  IF limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'current', current_count,
      'limit', NULL,
      'remaining', NULL,
      'plan', plan_record.plan_name
    );
  END IF;
  
  -- Check if within limits
  result := jsonb_build_object(
    'allowed', (current_count + p_requested_amount) <= limit_value,
    'current', current_count,
    'limit', limit_value,
    'remaining', GREATEST(0, limit_value - current_count),
    'requested', p_requested_amount,
    'plan', plan_record.plan_name
  );
  
  RETURN result;
END;
$$;