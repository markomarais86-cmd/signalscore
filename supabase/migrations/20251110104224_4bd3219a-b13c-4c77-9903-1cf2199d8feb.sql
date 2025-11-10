-- Add enrichment cost tracking (simplified)

-- Add cost tracking columns to enrichment_history
ALTER TABLE public.enrichment_history 
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_breakdown JSONB DEFAULT '{}'::jsonb;

-- Create enrichment_spending table for monthly tracking
CREATE TABLE IF NOT EXISTS public.enrichment_spending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  month_start DATE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('pdl', 'clearbit', 'ai', 'deep_research')),
  total_spent NUMERIC NOT NULL DEFAULT 0,
  total_calls INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, month_start, phase)
);

-- Enable RLS
ALTER TABLE public.enrichment_spending ENABLE ROW LEVEL SECURITY;

-- RLS policies for enrichment_spending
CREATE POLICY "Users can view their org spending"
  ON public.enrichment_spending FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert spending"
  ON public.enrichment_spending FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update spending"
  ON public.enrichment_spending FOR UPDATE
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_enrichment_spending_org_month 
  ON public.enrichment_spending(org_id, month_start DESC);

-- Add comment
COMMENT ON TABLE public.enrichment_spending IS 'Tracks monthly enrichment spending by phase for budget management';