-- Add manually_verified column to track user-corrected fields that should not be overwritten
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS manually_verified jsonb DEFAULT '{}'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN public.accounts.manually_verified IS 'Tracks fields manually corrected by users. Structure: {"field_name": true}. These fields should not be overwritten during re-enrichment.';