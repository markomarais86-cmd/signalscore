-- Add export_eligible column to Leads table
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS export_eligible boolean DEFAULT true;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_export_eligible ON "Leads"(org_id, export_eligible) WHERE export_eligible = true;

-- Add comment
COMMENT ON COLUMN "Leads".export_eligible IS 'Flag to mark leads as eligible for export (false = suppressed/duplicate)';