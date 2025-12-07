-- Add missing columns to ai_agents table
ALTER TABLE public.ai_agents 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;

-- Sync existing status values to enabled column
UPDATE public.ai_agents SET enabled = (status = 'active') WHERE enabled IS NULL;