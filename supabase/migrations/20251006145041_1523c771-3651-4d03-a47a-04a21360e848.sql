-- Add persona column to Leads table
ALTER TABLE public."Leads" ADD COLUMN persona text;

-- Create trigger function to auto-map persona on insert/update
CREATE OR REPLACE FUNCTION public.map_lead_persona()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.title IS NOT NULL THEN
    NEW.persona := public.map_title_to_persona(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER map_lead_persona_on_change
  BEFORE INSERT OR UPDATE OF title ON public."Leads"
  FOR EACH ROW
  EXECUTE FUNCTION public.map_lead_persona();

-- Backfill existing leads with personas
UPDATE public."Leads"
SET persona = public.map_title_to_persona(title)
WHERE title IS NOT NULL;

-- Update count_campaign_ready_leads to check lead's own persona
CREATE OR REPLACE FUNCTION public.count_campaign_ready_leads(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND s.overall >= 70
    AND l.email IS NOT NULL
    AND l.email LIKE '%@%'
    AND l.persona IS NOT NULL
    AND l.persona != 'Unknown';
  
  RETURN COALESCE(v_count, 0);
END;
$function$;