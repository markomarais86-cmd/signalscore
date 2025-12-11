-- Pause lead/follow-up/meeting agents (not in current data-focused phase)
UPDATE public.ai_agents
SET status = 'paused', enabled = false
WHERE agent_type IN ('lead_qualification', 'follow_up', 'meeting_scheduler');