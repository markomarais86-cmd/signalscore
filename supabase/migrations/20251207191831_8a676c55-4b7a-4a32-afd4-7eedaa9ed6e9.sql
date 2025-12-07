-- Delete duplicate agents, keeping one per org/type (most recently updated)
WITH ranked_agents AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY org_id, agent_type ORDER BY updated_at DESC, id DESC) as rn
  FROM ai_agents
)
DELETE FROM ai_agents 
WHERE id IN (SELECT id FROM ranked_agents WHERE rn > 1);

-- Enable remaining feature flags
UPDATE feature_flags SET enabled = true WHERE feature_key = 'pipeline_efficiency';
UPDATE feature_flags SET enabled = true WHERE feature_key = 'capital_efficiency';