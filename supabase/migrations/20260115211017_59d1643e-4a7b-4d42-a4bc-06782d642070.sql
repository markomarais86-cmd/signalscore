-- Update trigger function to eliminate gray zone (use 60 as threshold)
CREATE OR REPLACE FUNCTION sync_account_score_to_leads()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.overall IS NOT NULL THEN
    UPDATE "Leads"
    SET 
      icp_qualified = CASE 
        WHEN NEW.overall >= 60 THEN true 
        ELSE false 
      END,
      updated_at = NOW()
    WHERE account_external_id = NEW.account_external_id
      AND org_id = NEW.org_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill all currently unevaluated leads (those with icp_qualified IS NULL)
UPDATE "Leads" l
SET 
  icp_qualified = CASE 
    WHEN s.overall >= 60 THEN true 
    ELSE false 
  END,
  updated_at = NOW()
FROM accounts a
JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
WHERE l.account_external_id = a.external_id
  AND l.org_id = a.org_id
  AND l.icp_qualified IS NULL
  AND s.overall IS NOT NULL;