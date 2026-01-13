
-- Fix RLS policies for ai_agents table
DROP POLICY IF EXISTS "Users can view their org's agents" ON ai_agents;
DROP POLICY IF EXISTS "Users can manage their org's agents" ON ai_agents;

-- Create proper org-scoped policies for ai_agents
CREATE POLICY "Users can view agents in their org"
ON ai_agents FOR SELECT
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert agents in their org"
ON ai_agents FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update agents in their org"
ON ai_agents FOR UPDATE
USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete agents in their org"
ON ai_agents FOR DELETE
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Fix RLS policies for ai_agent_runs table
DROP POLICY IF EXISTS "Users can view agent runs" ON ai_agent_runs;

-- Create proper policy that checks org through the agent relationship
CREATE POLICY "Users can view runs for their org's agents"
ON ai_agent_runs FOR SELECT
USING (
  agent_id IN (
    SELECT id FROM ai_agents WHERE org_id = get_current_user_org_id()
  )
);

-- Allow service role to insert runs (system operations)
CREATE POLICY "System can insert agent runs"
ON ai_agent_runs FOR INSERT
WITH CHECK (true);

-- Fix RLS policies for ai_agent_feedback table
DROP POLICY IF EXISTS "System can manage feedback" ON ai_agent_feedback;

-- The other policies already have proper org checks, just remove the overly permissive one
-- Users can view/insert/update feedback in their org is already there
