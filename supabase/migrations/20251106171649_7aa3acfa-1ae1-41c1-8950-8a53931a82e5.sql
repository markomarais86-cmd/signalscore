-- Create webhook logs table for tracking Salesforce webhooks
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  webhook_type TEXT NOT NULL CHECK (webhook_type IN ('outbound_message', 'platform_event', 'change_data_capture')),
  object_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'undeleted')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster lookups
CREATE INDEX idx_webhook_logs_org_id ON public.webhook_logs(org_id);
CREATE INDEX idx_webhook_logs_record_id ON public.webhook_logs(record_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_processed ON public.webhook_logs(processed) WHERE processed = false;

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view webhook logs in their org"
  ON public.webhook_logs
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update webhook logs"
  ON public.webhook_logs
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete webhook logs"
  ON public.webhook_logs
  FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Add comment
COMMENT ON TABLE public.webhook_logs IS 'Logs all incoming Salesforce webhooks for debugging and tracking';
