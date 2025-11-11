-- Add breakdown columns to external_data_sources for rich market intelligence
ALTER TABLE external_data_sources
ADD COLUMN IF NOT EXISTS geography_breakdown JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS industry_breakdown JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS company_size_breakdown JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS revenue_breakdown JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS technology_breakdown JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS funding_breakdown JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN external_data_sources.geography_breakdown IS 'Country/state distribution with account counts and percentages';
COMMENT ON COLUMN external_data_sources.industry_breakdown IS 'Industry distribution with account counts and percentages';
COMMENT ON COLUMN external_data_sources.company_size_breakdown IS 'Employee size ranges with account counts and percentages';
COMMENT ON COLUMN external_data_sources.revenue_breakdown IS 'Revenue ranges with account counts and percentages';
COMMENT ON COLUMN external_data_sources.technology_breakdown IS 'Technology stack adoption with account counts';
COMMENT ON COLUMN external_data_sources.funding_breakdown IS 'Funding stages with account counts and percentages';