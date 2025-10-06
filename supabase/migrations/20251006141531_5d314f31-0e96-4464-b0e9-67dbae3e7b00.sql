-- Phase 1: Persona Mapping Function
CREATE OR REPLACE FUNCTION public.map_title_to_persona(title_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF title_input IS NULL OR title_input = '' THEN
    RETURN 'Unknown';
  END IF;

  -- C-Level Technical
  IF title_input ~* '(cto|chief technology|chief technical|vp engineering|cio|chief information|chief digital)' THEN
    RETURN 'Technical Decision Maker';
  END IF;

  -- C-Level Business
  IF title_input ~* '(ceo|chief executive|president|founder|owner|cfo|chief financial|coo|chief operating|cmo|chief marketing)' THEN
    RETURN 'Business Decision Maker';
  END IF;

  -- VP/Director Technical
  IF title_input ~* '(director of engineering|director of technology|head of engineering|head of technology|engineering manager|director of software|head of software|director of it|head of it|it director)' THEN
    RETURN 'Technical Decision Maker';
  END IF;

  -- VP/Director IT
  IF title_input ~* '(director of information|it manager|systems manager|infrastructure manager|operations manager|director of operations|head of operations)' THEN
    RETURN 'IT Decision Maker';
  END IF;

  -- VP/Director Business
  IF title_input ~* '(vp|vice president|director of product|head of product|product director|director of strategy|head of strategy|director of sales|head of sales)' THEN
    RETURN 'Business Decision Maker';
  END IF;

  -- Senior Technical
  IF title_input ~* '(senior engineer|lead engineer|principal engineer|staff engineer|senior developer|lead developer|architect|solutions architect)' THEN
    RETURN 'Technical Influencer';
  END IF;

  -- Senior Business
  IF title_input ~* '(senior product|lead product|principal product|senior program|senior project|senior analyst|lead analyst)' THEN
    RETURN 'Business Influencer';
  END IF;

  -- Mid-Level Technical
  IF title_input ~* '(engineer|developer|programmer|devops|sre|site reliability|security engineer|qa engineer)' THEN
    RETURN 'Technical Influencer';
  END IF;

  -- Mid-Level Business
  IF title_input ~* '(product manager|program manager|project manager|business analyst|product owner|scrum master)' THEN
    RETURN 'Business Influencer';
  END IF;

  -- IT Staff
  IF title_input ~* '(it specialist|it support|help desk|desktop support|system administrator|sysadmin|network administrator|database administrator|dba)' THEN
    RETURN 'IT Decision Maker';
  END IF;

  -- End Users
  IF title_input ~* '(coordinator|assistant|associate|specialist|intern|trainee|junior)' THEN
    RETURN 'End User';
  END IF;

  RETURN 'Unknown';
END;
$$;

-- Batch update all existing contacts with personas
UPDATE public.contacts
SET persona = public.map_title_to_persona(title_raw)
WHERE title_raw IS NOT NULL 
  AND (persona IS NULL OR persona = 'Unknown');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_persona ON public.contacts(persona);

-- Phase 4: Add campaign_ready_mode setting
INSERT INTO public.feature_flags (org_id, feature_key, enabled)
SELECT DISTINCT org_id, 'campaign_ready_flexible_mode', false
FROM public.user_profiles
ON CONFLICT (org_id, feature_key) DO NOTHING;