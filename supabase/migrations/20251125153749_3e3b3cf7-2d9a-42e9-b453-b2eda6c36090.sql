-- Function to seed default AI agents for an organization
CREATE OR REPLACE FUNCTION seed_default_ai_agents(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if agents already exist for this org
  IF EXISTS (SELECT 1 FROM ai_agents WHERE org_id = target_org_id) THEN
    RETURN;
  END IF;

  -- Insert 4 default AI agents
  INSERT INTO ai_agents (org_id, name, agent_type, description, schedule, status, parameters) VALUES
  (
    target_org_id,
    'Lead Qualification Agent',
    'lead_qualification',
    'Automatically scores and qualifies new leads based on ICP criteria',
    'daily',
    'active',
    '{"min_score_threshold": 70}'::jsonb
  ),
  (
    target_org_id,
    'Follow-Up Agent',
    'follow_up',
    'Identifies leads that need follow-up and triggers engagement sequences',
    'daily',
    'active',
    '{"sequence_delay_days": 3, "max_attempts": 5}'::jsonb
  ),
  (
    target_org_id,
    'Meeting Scheduler Agent',
    'meeting_scheduler',
    'Automatically requests meetings with high-score qualified leads',
    'daily',
    'active',
    '{"min_lead_score": 75}'::jsonb
  ),
  (
    target_org_id,
    'Data Enrichment Agent',
    'data_enrichment',
    'Enriches accounts with missing firmographic data',
    'weekly',
    'active',
    '{"batch_size": 50}'::jsonb
  );
END;
$$;

-- Trigger to seed agents when a new organization is created
CREATE OR REPLACE FUNCTION trigger_seed_agents_on_org_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_default_ai_agents(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger on organizations table
DROP TRIGGER IF EXISTS seed_agents_on_org_insert ON organizations;
CREATE TRIGGER seed_agents_on_org_insert
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_agents_on_org_create();

-- Seed agents for all existing organizations without agents
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM seed_default_ai_agents(org_record.id);
  END LOOP;
END;
$$;

-- Create calculate_next_run RPC function for agent scheduling
CREATE OR REPLACE FUNCTION calculate_next_run(schedule text, last_run timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE schedule
    WHEN 'daily' THEN
      RETURN last_run + interval '1 day';
    WHEN 'weekly' THEN
      RETURN last_run + interval '7 days';
    WHEN 'hourly' THEN
      RETURN last_run + interval '1 hour';
    ELSE
      RETURN last_run + interval '1 day';
  END CASE;
END;
$$;