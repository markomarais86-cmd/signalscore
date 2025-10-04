-- Create country normalization function
CREATE OR REPLACE FUNCTION public.normalize_country(country_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF country_input IS NULL OR country_input = '' THEN
    RETURN NULL;
  END IF;
  
  -- Normalize common country variations to standard names
  RETURN CASE LOWER(TRIM(country_input))
    -- United States variations
    WHEN 'us' THEN 'United States'
    WHEN 'usa' THEN 'United States'
    WHEN 'united states of america' THEN 'United States'
    WHEN 'vereinigte staaten' THEN 'United States'
    WHEN 'estados unidos' THEN 'United States'
    WHEN 'états-unis' THEN 'United States'
    
    -- United Kingdom variations
    WHEN 'uk' THEN 'United Kingdom'
    WHEN 'great britain' THEN 'United Kingdom'
    WHEN 'britain' THEN 'United Kingdom'
    WHEN 'england' THEN 'United Kingdom'
    WHEN 'vereinigtes königreich' THEN 'United Kingdom'
    WHEN 'royaume-uni' THEN 'United Kingdom'
    
    -- Germany variations
    WHEN 'de' THEN 'Germany'
    WHEN 'deutschland' THEN 'Germany'
    WHEN 'allemagne' THEN 'Germany'
    
    -- Canada variations
    WHEN 'ca' THEN 'Canada'
    WHEN 'kanada' THEN 'Canada'
    
    -- France variations
    WHEN 'fr' THEN 'France'
    WHEN 'frankreich' THEN 'France'
    
    -- Australia variations
    WHEN 'au' THEN 'Australia'
    WHEN 'australien' THEN 'Australia'
    WHEN 'australie' THEN 'Australia'
    
    -- Japan variations
    WHEN 'jp' THEN 'Japan'
    WHEN 'japon' THEN 'Japan'
    WHEN 'japan' THEN 'Japan'
    
    -- China variations
    WHEN 'cn' THEN 'China'
    WHEN 'prc' THEN 'China'
    WHEN 'people''s republic of china' THEN 'China'
    
    -- India variations
    WHEN 'in' THEN 'India'
    WHEN 'indien' THEN 'India'
    WHEN 'inde' THEN 'India'
    
    -- Spain variations
    WHEN 'es' THEN 'Spain'
    WHEN 'españa' THEN 'Spain'
    WHEN 'espagne' THEN 'Spain'
    WHEN 'spanien' THEN 'Spain'
    
    -- Italy variations
    WHEN 'it' THEN 'Italy'
    WHEN 'italia' THEN 'Italy'
    WHEN 'italie' THEN 'Italy'
    WHEN 'italien' THEN 'Italy'
    
    -- Netherlands variations
    WHEN 'nl' THEN 'Netherlands'
    WHEN 'holland' THEN 'Netherlands'
    WHEN 'pays-bas' THEN 'Netherlands'
    WHEN 'niederlande' THEN 'Netherlands'
    
    -- Singapore variations
    WHEN 'sg' THEN 'Singapore'
    WHEN 'singapur' THEN 'Singapore'
    WHEN 'singapour' THEN 'Singapore'
    
    -- Default: capitalize first letter of each word
    ELSE INITCAP(TRIM(country_input))
  END;
END;
$$;

-- One-time migration to normalize existing country data
UPDATE public.accounts
SET country = public.normalize_country(country)
WHERE country IS NOT NULL;

UPDATE public.contacts
SET country = public.normalize_country(country)
WHERE country IS NOT NULL;

UPDATE public."Leads"
SET country = public.normalize_country(country)
WHERE country IS NOT NULL;

-- Create trigger to normalize country on insert/update for accounts
CREATE OR REPLACE FUNCTION public.normalize_account_country()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_account_country_trigger
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_account_country();

-- Create trigger for contacts
CREATE OR REPLACE FUNCTION public.normalize_contact_country()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_contact_country_trigger
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_contact_country();

-- Create trigger for leads
CREATE OR REPLACE FUNCTION public.normalize_lead_country()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_lead_country_trigger
BEFORE INSERT OR UPDATE ON public."Leads"
FOR EACH ROW
EXECUTE FUNCTION public.normalize_lead_country();

-- Add helper function to count campaign-ready leads (not just accounts)
CREATE OR REPLACE FUNCTION public.count_campaign_ready_leads(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  INNER JOIN contacts c ON l.account_external_id = c.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND c.org_id = p_org_id
    AND s.overall >= 70;
  
  RETURN COALESCE(v_count, 0);
END;
$$;