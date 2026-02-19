-- Fix 1: Clean up 6 stuck agent runs
UPDATE ai_agent_runs 
SET status = 'failed', 
    completed_at = now(), 
    error_message = 'Auto-cleaned: orphaned running state during GTM pipeline fix'
WHERE status = 'running' 
  AND started_at < now() - interval '1 hour';

-- Fix 4 (partial): Reindex scores table to resolve statement timeouts
REINDEX TABLE public.scores;