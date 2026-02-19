
-- Add default_acv column to organizations table for per-customer revenue modeling
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS default_acv numeric DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.organizations.default_acv IS 'Per-org average contract value for revenue modeling. NULL = use platform default ($75K).';
