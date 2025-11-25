-- Add missing fields to integration_sync_logs for better tracking

-- Add provider_name field
ALTER TABLE public.integration_sync_logs 
ADD COLUMN IF NOT EXISTS provider_name TEXT;

-- Add sync_type field (scheduled_sync, manual_sync, campaign_push, etc.)
ALTER TABLE public.integration_sync_logs 
ADD COLUMN IF NOT EXISTS sync_type TEXT;

-- Add error_details field for structured error information
ALTER TABLE public.integration_sync_logs 
ADD COLUMN IF NOT EXISTS error_details JSONB;

-- Create index for faster queries by provider and sync type
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_provider 
ON public.integration_sync_logs(provider_name);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_sync_type 
ON public.integration_sync_logs(sync_type);

-- Create index for real-time queries
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_org_started 
ON public.integration_sync_logs(org_id, started_at DESC);

COMMENT ON COLUMN public.integration_sync_logs.provider_name IS 'The integration provider (salesforce, hubspot, etc.)';
COMMENT ON COLUMN public.integration_sync_logs.sync_type IS 'Type of sync operation (scheduled_sync, manual_sync, campaign_push, etc.)';
COMMENT ON COLUMN public.integration_sync_logs.error_details IS 'Structured error information for debugging';