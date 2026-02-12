
-- Phase 3: Opportunity Tracking - Add attribution and win/loss detail columns to deals

-- Win reason for closed-won deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS win_reason text;

-- Loss category (structured) + keep existing loss_reason for free-text
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS loss_category text; -- budget, timing, competition, no_decision, other

-- Link deal back to originating marketing lead for attribution
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS marketing_lead_id uuid REFERENCES public.marketing_leads(id);

-- Copy UTM/click data at deal creation for attribution snapshots
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS attribution_utm jsonb DEFAULT '{}';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS attribution_click_ids jsonb DEFAULT '{}';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS attribution_funnel_variant text;

-- Stage change trigger: auto-record to deal_stage_history
CREATE OR REPLACE FUNCTION public.track_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    -- Close out previous stage
    UPDATE public.deal_stage_history 
    SET exited_at = now() 
    WHERE deal_id = NEW.id AND exited_at IS NULL;
    
    -- Insert new stage entry
    INSERT INTO public.deal_stage_history (deal_id, org_id, stage, entered_at)
    VALUES (NEW.id, NEW.org_id, NEW.stage, now());

    -- Auto-set status based on stage
    IF NEW.stage = 'closed_won' THEN
      NEW.status := 'won';
      NEW.closed_date := CURRENT_DATE;
    ELSIF NEW.stage = 'closed_lost' THEN
      NEW.status := 'lost';
      NEW.closed_date := CURRENT_DATE;
    ELSE
      NEW.status := 'open';
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON public.deals;
CREATE TRIGGER trg_deal_stage_change
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.track_deal_stage_change();

-- Also record initial stage on INSERT
CREATE OR REPLACE FUNCTION public.track_deal_stage_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.deal_stage_history (deal_id, org_id, stage, entered_at)
  VALUES (NEW.id, NEW.org_id, NEW.stage, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_deal_stage_insert ON public.deals;
CREATE TRIGGER trg_deal_stage_insert
  AFTER INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.track_deal_stage_insert();

-- Indexes for attribution queries
CREATE INDEX IF NOT EXISTS idx_deals_marketing_lead_id ON public.deals(marketing_lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_loss_category ON public.deals(loss_category);
CREATE INDEX IF NOT EXISTS idx_deals_stage_status ON public.deals(stage, status);

-- RLS: deals already has RLS enabled, just ensure the new columns are covered by existing policies
