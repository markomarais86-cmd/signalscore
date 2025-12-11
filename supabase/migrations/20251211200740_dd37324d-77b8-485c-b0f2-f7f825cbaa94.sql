-- Phase 1: Un-pause Launchpulse agents and clean up duplicate run records

-- Update all agents in the Launchpulse org to active status
UPDATE ai_agents
SET status = 'active', enabled = true
WHERE org_id IN (
  SELECT id FROM organizations WHERE name ILIKE '%launchpulse%'
);

-- Clean up duplicate "running" records that were never completed
-- Keep the most recent one for each agent and delete older stuck records
DELETE FROM ai_agent_runs
WHERE id IN (
  SELECT r.id
  FROM ai_agent_runs r
  WHERE r.status = 'running'
  AND r.started_at < NOW() - INTERVAL '1 hour'
);