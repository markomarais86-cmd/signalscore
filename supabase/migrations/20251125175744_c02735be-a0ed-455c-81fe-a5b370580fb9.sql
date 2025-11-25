-- Disable the scheduled agent runner cron job for MVP rollout
SELECT cron.unschedule('run-ai-agents-hourly');