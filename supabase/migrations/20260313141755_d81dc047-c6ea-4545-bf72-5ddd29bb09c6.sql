
-- Add Microsoft Teams webhook URL column to alerts table
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS teams_webhook_url TEXT;

-- Add new alert types for signals, agent completions, and campaign results
-- (These are stored as alert_type text values, no schema change needed, but let's add a comment)
COMMENT ON COLUMN public.alerts.teams_webhook_url IS 'Microsoft Teams incoming webhook URL for notifications';
