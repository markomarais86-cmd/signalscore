
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS fuel_line_type text,
  ADD COLUMN IF NOT EXISTS signal_source_ids text[];
