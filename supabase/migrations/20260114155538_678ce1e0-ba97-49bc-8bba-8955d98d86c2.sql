-- Add missing columns to sync_jobs table for bidirectional sync orchestrator
ALTER TABLE public.sync_jobs 
ADD COLUMN IF NOT EXISTS direction text DEFAULT 'to_accounts',
ADD COLUMN IF NOT EXISTS total_records integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_records integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_records integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_offset integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;