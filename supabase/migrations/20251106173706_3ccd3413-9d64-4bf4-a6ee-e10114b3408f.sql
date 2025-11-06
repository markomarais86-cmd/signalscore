-- Add retry fields to webhook_logs table
ALTER TABLE public.webhook_logs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS permanently_failed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Create index for finding webhooks that need retry
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry 
ON public.webhook_logs(next_retry_at) 
WHERE processed = false AND permanently_failed = false;

-- Add comment
COMMENT ON COLUMN public.webhook_logs.retry_count IS 'Number of times this webhook has been retried';
COMMENT ON COLUMN public.webhook_logs.next_retry_at IS 'Timestamp when the next retry should be attempted';
COMMENT ON COLUMN public.webhook_logs.permanently_failed IS 'True if webhook has exceeded max retries and will not be retried again';
