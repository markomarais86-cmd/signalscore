-- Phase 2: Add enrichment_source column to Leads table if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Leads' 
    AND column_name = 'enrichment_source'
  ) THEN
    ALTER TABLE public."Leads" ADD COLUMN enrichment_source text;
    COMMENT ON COLUMN public."Leads".enrichment_source IS 'Source of the lead: ai_discovered, apollo, pdl, manual, csv, crm';
  END IF;
END $$;

-- Add discovered_from_account column if missing (for contact discovery)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Leads' 
    AND column_name = 'discovered_from_account'
  ) THEN
    ALTER TABLE public."Leads" ADD COLUMN discovered_from_account text;
    COMMENT ON COLUMN public."Leads".discovered_from_account IS 'External ID of account this lead was discovered from';
  END IF;
END $$;

-- Create index for faster queries on discovered leads
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_source ON public."Leads"(enrichment_source) WHERE enrichment_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_discovered_from ON public."Leads"(discovered_from_account) WHERE discovered_from_account IS NOT NULL;