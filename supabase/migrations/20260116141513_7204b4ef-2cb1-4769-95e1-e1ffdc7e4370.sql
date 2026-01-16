-- Create function to aggregate top lead titles server-side (replaces client-side aggregation)
CREATE OR REPLACE FUNCTION get_top_lead_titles(p_org_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE(title TEXT, count BIGINT) AS $$
  SELECT "Leads".title, COUNT(*) as count
  FROM "Leads"
  WHERE org_id = p_org_id AND title IS NOT NULL
  GROUP BY "Leads".title
  ORDER BY count DESC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

-- Add icp_threshold column to organizations table for configurable threshold
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS icp_threshold INTEGER DEFAULT 60;

-- Add comment for documentation
COMMENT ON COLUMN organizations.icp_threshold IS 'Configurable ICP qualification threshold (0-100). Accounts with scores >= this value are marked as ICP qualified.';