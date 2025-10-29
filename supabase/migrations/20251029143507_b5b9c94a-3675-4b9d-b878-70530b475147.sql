-- Integration Management System (Fixed)
-- Creates tables for managing integrations, credentials, OAuth flows, and sync logs

-- =====================================================
-- TABLE 1: integration_configs
-- Stores configuration for each integration
-- =====================================================
CREATE TABLE IF NOT EXISTS public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  provider_name TEXT NOT NULL,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('crm', 'data_enrichment', 'marketing_automation', 'analytics')),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
  config JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(org_id, provider_name)
);

CREATE INDEX idx_integration_configs_org_id ON public.integration_configs(org_id);
CREATE INDEX idx_integration_configs_status ON public.integration_configs(status);
CREATE INDEX idx_integration_configs_provider ON public.integration_configs(provider_name);

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's integrations"
  ON public.integration_configs FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert integrations"
  ON public.integration_configs FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can update integrations"
  ON public.integration_configs FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete integrations"
  ON public.integration_configs FOR DELETE
  USING (org_id = get_current_user_org_id());

-- =====================================================
-- TABLE 2: integration_credentials
-- =====================================================
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  integration_config_id UUID REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('api_key', 'oauth_token', 'basic_auth')),
  encrypted_value TEXT NOT NULL,
  key_prefix TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_integration_credentials_org_id ON public.integration_credentials(org_id);
CREATE INDEX idx_integration_credentials_config_id ON public.integration_credentials(integration_config_id);
CREATE INDEX idx_integration_credentials_expires ON public.integration_credentials(expires_at);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's credentials"
  ON public.integration_credentials FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert credentials"
  ON public.integration_credentials FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can update credentials"
  ON public.integration_credentials FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete credentials"
  ON public.integration_credentials FOR DELETE
  USING (org_id = get_current_user_org_id());

-- =====================================================
-- TABLE 3: integration_sync_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  integration_config_id UUID REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_integration_sync_logs_org_id ON public.integration_sync_logs(org_id);
CREATE INDEX idx_integration_sync_logs_config_id ON public.integration_sync_logs(integration_config_id);
CREATE INDEX idx_integration_sync_logs_started_at ON public.integration_sync_logs(started_at DESC);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's sync logs"
  ON public.integration_sync_logs FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert sync logs"
  ON public.integration_sync_logs FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "System can update sync logs"
  ON public.integration_sync_logs FOR UPDATE
  USING (org_id = get_current_user_org_id());

-- =====================================================
-- TABLE 4: oauth_state
-- =====================================================
CREATE TABLE IF NOT EXISTS public.oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  redirect_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_oauth_state_token ON public.oauth_state(state_token);
CREATE INDEX idx_oauth_state_expires ON public.oauth_state(expires_at);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's OAuth states"
  ON public.oauth_state FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert OAuth states"
  ON public.oauth_state FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "System can delete OAuth states"
  ON public.oauth_state FOR DELETE
  USING (org_id = get_current_user_org_id());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integration_configs_updated_at
  BEFORE UPDATE ON public.integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_integration_updated_at();

CREATE TRIGGER update_integration_credentials_updated_at
  BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_integration_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.oauth_state WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_integration_change()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        NEW.org_id,
        COALESCE(NEW.created_by::text, 'system'),
        'integration_connected',
        jsonb_build_object('provider', NEW.provider_name, 'type', NEW.integration_type, 'resource_id', NEW.id)
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        NEW.org_id,
        COALESCE(auth.uid()::text, 'system'),
        'integration_status_changed',
        jsonb_build_object('provider', NEW.provider_name, 'old_status', OLD.status, 'new_status', NEW.status, 'resource_id', NEW.id)
      );
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        OLD.org_id,
        COALESCE(auth.uid()::text, 'system'),
        'integration_disconnected',
        jsonb_build_object('provider', OLD.provider_name, 'resource_id', OLD.id)
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_integration_config_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_integration_change();