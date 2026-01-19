-- Add level and persona columns for title classification
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS persona TEXT;

-- Create index for filtering by level
CREATE INDEX IF NOT EXISTS idx_leads_level ON "Leads" (level) WHERE level IS NOT NULL;

-- Create index for filtering by persona  
CREATE INDEX IF NOT EXISTS idx_leads_persona ON "Leads" (persona) WHERE persona IS NOT NULL;

COMMENT ON COLUMN "Leads".level IS 'Seniority level derived from title: C-Level, VP, Director, Manager, Senior, Individual Contributor';
COMMENT ON COLUMN "Leads".persona IS 'Business persona derived from title: Executive, Senior Leadership, Decision Maker, Influencer, Operations, Sales, Marketing, End User';