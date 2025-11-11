-- Create table to track incoming webhooks from Clay/Zapier
CREATE TABLE IF NOT EXISTS public.clay_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_clay_webhook_logs_org_id ON public.clay_webhook_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_clay_webhook_logs_processed ON public.clay_webhook_logs(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clay_webhook_logs_webhook_type ON public.clay_webhook_logs(webhook_type);

-- Enable RLS
ALTER TABLE public.clay_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view webhook logs in their org"
  ON public.clay_webhook_logs
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert webhook logs"
  ON public.clay_webhook_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update webhook logs"
  ON public.clay_webhook_logs
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete webhook logs"
  ON public.clay_webhook_logs
  FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Add table to track incoming webhook configuration
CREATE TABLE IF NOT EXISTS public.clay_webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, webhook_type)
);

-- Enable RLS
ALTER TABLE public.clay_webhook_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view webhook config in their org"
  ON public.clay_webhook_config
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can manage webhook config"
  ON public.clay_webhook_config
  FOR ALL
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Add index
CREATE INDEX IF NOT EXISTS idx_clay_webhook_config_org_id ON public.clay_webhook_config(org_id);