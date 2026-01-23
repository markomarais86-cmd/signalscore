-- 1. Add bonus credits column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS enrichment_credits_bonus INTEGER DEFAULT 0;

-- 2. Credit adjustments audit table
CREATE TABLE IF NOT EXISTS credit_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('reset', 'manual', 'plan_change', 'top_up', 'consumption')),
  previous_used INTEGER,
  previous_total INTEGER,
  previous_bonus INTEGER,
  new_used INTEGER,
  new_total INTEGER,
  new_bonus INTEGER,
  credits_added INTEGER,
  reason TEXT,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_org_id ON credit_adjustments(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_created_at ON credit_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_type ON credit_adjustments(adjustment_type);

-- 4. Enable RLS
ALTER TABLE credit_adjustments ENABLE ROW LEVEL SECURITY;

-- 5. RLS policy - allow all authenticated users to view (super admin check will be in app code)
CREATE POLICY "Authenticated users can view credit adjustments" 
ON credit_adjustments FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert credit adjustments" 
ON credit_adjustments FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 6. Function to sync credits when plan changes
CREATE OR REPLACE FUNCTION sync_plan_credits()
RETURNS TRIGGER AS $$
DECLARE
  new_credit_limit INTEGER;
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.plan_id IS NOT NULL THEN
    -- Get the credit limit from plan_limits
    SELECT enrichment_credits_monthly INTO new_credit_limit
    FROM plan_limits WHERE id = NEW.plan_id;
    
    -- Update the organization's credit total
    NEW.enrichment_credits_total := COALESCE(new_credit_limit, NEW.enrichment_credits_total);
    
    -- Log the adjustment
    INSERT INTO credit_adjustments (
      org_id, adjustment_type, previous_total, new_total, 
      previous_used, new_used, previous_bonus, new_bonus,
      reason, performed_by
    ) VALUES (
      NEW.id, 'plan_change', OLD.enrichment_credits_total, NEW.enrichment_credits_total,
      OLD.enrichment_credits_used, NEW.enrichment_credits_used,
      OLD.enrichment_credits_bonus, NEW.enrichment_credits_bonus,
      'Plan changed to ' || NEW.plan_id, 'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create the trigger
DROP TRIGGER IF EXISTS trigger_sync_plan_credits ON organizations;
CREATE TRIGGER trigger_sync_plan_credits
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION sync_plan_credits();