-- Create function to prevent duplicate lead inserts
CREATE OR REPLACE FUNCTION prevent_duplicate_leads()
RETURNS TRIGGER AS $$
DECLARE
  existing_lead_id bigint;
  existing_account_id text;
  existing_score numeric;
  new_score numeric;
BEGIN
  -- Only check if email is provided
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  -- Look for existing lead with same email in same org
  SELECT l.id, l.account_external_id, COALESCE(s.overall, 0)
  INTO existing_lead_id, existing_account_id, existing_score
  FROM public."Leads" l
  LEFT JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  WHERE l.org_id = NEW.org_id
    AND LOWER(l.email) = LOWER(NEW.email)
    AND l.id != COALESCE(NEW.id, 0)
  ORDER BY COALESCE(s.overall, 0) DESC
  LIMIT 1;

  -- If duplicate found
  IF existing_lead_id IS NOT NULL THEN
    -- Get score for new lead's account
    SELECT COALESCE(overall, 0) INTO new_score
    FROM public.scores
    WHERE org_id = NEW.org_id AND account_external_id = NEW.account_external_id;
    
    -- If new lead has higher score, mark existing as duplicate and allow new
    IF COALESCE(new_score, 0) > existing_score THEN
      UPDATE public."Leads"
      SET export_eligible = false,
          suppression_reason = 'Duplicate of lead ' || NEW.id
      WHERE id = existing_lead_id;
      
      RAISE NOTICE 'Marked existing lead % as duplicate, keeping new lead with higher score', existing_lead_id;
      RETURN NEW;
    ELSE
      -- Mark new lead as duplicate
      NEW.export_eligible := false;
      NEW.suppression_reason := 'Duplicate of lead ' || existing_lead_id;
      RAISE NOTICE 'Marking new lead as duplicate of existing lead %', existing_lead_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_duplicate_leads_trigger ON public."Leads";
CREATE TRIGGER prevent_duplicate_leads_trigger
  BEFORE INSERT ON public."Leads"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_leads();

-- Create index to speed up duplicate checks
CREATE INDEX IF NOT EXISTS idx_leads_email_org_lookup 
ON public."Leads" (org_id, LOWER(email)) 
WHERE email IS NOT NULL;