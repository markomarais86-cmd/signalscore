-- Backfill: Update existing leads with ICP qualification from account scores
-- Using 'overall' column instead of 'score'
UPDATE "Leads" l
SET 
  icp_qualified = CASE 
    WHEN s.overall >= 70 THEN true 
    WHEN s.overall < 50 THEN false 
    ELSE l.icp_qualified 
  END,
  updated_at = NOW()
FROM accounts a
JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
WHERE l.account_external_id = a.external_id
  AND l.org_id = a.org_id
  AND l.icp_qualified IS NULL
  AND s.overall IS NOT NULL;

-- Also fix the trigger function to use 'overall' instead of 'score'
CREATE OR REPLACE FUNCTION sync_account_score_to_leads()
RETURNS TRIGGER AS $$
BEGIN
  -- When an account gets a score, update ICP status on linked leads
  IF NEW.overall IS NOT NULL THEN
    UPDATE "Leads"
    SET 
      icp_qualified = CASE 
        WHEN NEW.overall >= 70 THEN true 
        WHEN NEW.overall < 50 THEN false 
        ELSE icp_qualified 
      END,
      updated_at = NOW()
    WHERE account_external_id = NEW.account_external_id
      AND org_id = NEW.org_id
      AND icp_qualified IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;