-- Enable realtime for automatic dashboard updates
-- This allows the dashboard to update automatically when data changes

-- Set REPLICA IDENTITY FULL to capture complete row data
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.bulk_scoring_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.enrichment_jobs REPLICA IDENTITY FULL;

-- Add tables to realtime publication (only if not already added)
DO $$ 
BEGIN
  -- Add accounts table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;

  -- Add bulk_scoring_jobs table  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'bulk_scoring_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_scoring_jobs;
  END IF;

  -- Add enrichment_jobs table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'enrichment_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.enrichment_jobs;
  END IF;
END $$;