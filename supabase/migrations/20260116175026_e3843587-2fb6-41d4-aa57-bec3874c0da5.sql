-- Add multi-phone schema to Leads table for storing multiple phones with source attribution
-- Like Eugene's spreadsheet: phone 1-6 from GEMINI, PERPLEXITY, APOLLO, PDL, ZOOMINFO, LUSHA, SQL, etc.

-- Add phones JSONB column: [{number, type, source, confidence, verified_at}]
ALTER TABLE "Leads" 
ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]'::jsonb;

-- Add phone_sources JSONB column: {gemini: [], perplexity: [], apollo: [], pdl: [], internal: []}
ALTER TABLE "Leads"
ADD COLUMN IF NOT EXISTS phone_sources JSONB DEFAULT '{}'::jsonb;

-- Add index for efficient querying of phones
CREATE INDEX IF NOT EXISTS idx_leads_phones ON "Leads" USING GIN (phones);

-- Comment to explain the structure
COMMENT ON COLUMN "Leads".phones IS 'Array of phone numbers with source attribution: [{number: string, type: direct|mobile|office, source: gemini|perplexity|apollo|pdl|internal|zoominfo|lusha, confidence: 0-100, verified_at?: timestamp}]';
COMMENT ON COLUMN "Leads".phone_sources IS 'Raw phone data by source for debugging: {gemini: [{...}], perplexity: [{...}], ...}';