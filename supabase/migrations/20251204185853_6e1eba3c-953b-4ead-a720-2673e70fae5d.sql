
-- =====================================================
-- SECURITY FIXES MIGRATION
-- =====================================================

-- 1. ENABLE RLS ON EXPOSED TABLES
-- =====================================================

-- Enable RLS on domain_aliases
ALTER TABLE public.domain_aliases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for domain_aliases
CREATE POLICY "Users can view their org domain aliases"
ON public.domain_aliases FOR SELECT
USING (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their org domain aliases"
ON public.domain_aliases FOR INSERT
WITH CHECK (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org domain aliases"
ON public.domain_aliases FOR UPDATE
USING (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org domain aliases"
ON public.domain_aliases FOR DELETE
USING (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Enable RLS on processing_locks
ALTER TABLE public.processing_locks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for processing_locks
CREATE POLICY "Users can view their org processing locks"
ON public.processing_locks FOR SELECT
USING (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their org processing locks"
ON public.processing_locks FOR INSERT
WITH CHECK (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org processing locks"
ON public.processing_locks FOR UPDATE
USING (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org processing locks"
ON public.processing_locks FOR DELETE
USING (org_id = (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- 2. FIX SECURITY DEFINER VIEW
-- =====================================================

-- Drop the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.account_processing_stats;

CREATE VIEW public.account_processing_stats AS
SELECT 
  a.org_id,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE a.enriched_at IS NOT NULL) as enriched_accounts,
  COUNT(*) FILTER (WHERE s.overall IS NOT NULL) as scored_accounts,
  COUNT(*) FILTER (WHERE a.icp_qualified = true) as icp_qualified_accounts
FROM public.accounts a
LEFT JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
GROUP BY a.org_id;

-- 3. ADD SEARCH_PATH TO FUNCTIONS WITHOUT IT
-- =====================================================

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix is_lead_campaign_ready
CREATE OR REPLACE FUNCTION public.is_lead_campaign_ready(p_email text, p_title text, p_persona text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  RETURN (
    p_email IS NOT NULL 
    AND p_email LIKE '%@%'
    AND p_title IS NOT NULL
    AND p_title != ''
    AND p_persona IS NOT NULL
    AND p_persona != 'Unknown'
  );
END;
$function$;

-- Fix update_enrichment_rows_updated_at
CREATE OR REPLACE FUNCTION public.update_enrichment_rows_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_leads_updated_at
CREATE OR REPLACE FUNCTION public.update_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix map_title_to_persona
CREATE OR REPLACE FUNCTION public.map_title_to_persona(title_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  IF title_input IS NULL OR title_input = '' THEN
    RETURN 'Unknown';
  END IF;

  IF title_input ~* '(cto|chief technology|chief technical|vp engineering|cio|chief information|chief digital)' THEN
    RETURN 'Technical Decision Maker';
  END IF;

  IF title_input ~* '(ceo|chief executive|president|founder|owner|cfo|chief financial|coo|chief operating|cmo|chief marketing)' THEN
    RETURN 'Business Decision Maker';
  END IF;

  IF title_input ~* '(director of engineering|director of technology|head of engineering|head of technology|engineering manager|director of software|head of software|director of it|head of it|it director)' THEN
    RETURN 'Technical Decision Maker';
  END IF;

  IF title_input ~* '(director of information|it manager|systems manager|infrastructure manager|operations manager|director of operations|head of operations)' THEN
    RETURN 'IT Decision Maker';
  END IF;

  IF title_input ~* '(vp|vice president|director of product|head of product|product director|director of strategy|head of strategy|director of sales|head of sales)' THEN
    RETURN 'Business Decision Maker';
  END IF;

  IF title_input ~* '(senior engineer|lead engineer|principal engineer|staff engineer|senior developer|lead developer|architect|solutions architect)' THEN
    RETURN 'Technical Influencer';
  END IF;

  IF title_input ~* '(senior product|lead product|principal product|senior program|senior project|senior analyst|lead analyst)' THEN
    RETURN 'Business Influencer';
  END IF;

  IF title_input ~* '(engineer|developer|programmer|devops|sre|site reliability|security engineer|qa engineer)' THEN
    RETURN 'Technical Influencer';
  END IF;

  IF title_input ~* '(product manager|program manager|project manager|business analyst|product owner|scrum master)' THEN
    RETURN 'Business Influencer';
  END IF;

  IF title_input ~* '(it specialist|it support|help desk|desktop support|system administrator|sysadmin|network administrator|database administrator|dba)' THEN
    RETURN 'IT Decision Maker';
  END IF;

  IF title_input ~* '(coordinator|assistant|associate|specialist|intern|trainee|junior)' THEN
    RETURN 'End User';
  END IF;

  RETURN 'Unknown';
END;
$function$;

-- Fix format_phone_to_e164
CREATE OR REPLACE FUNCTION public.format_phone_to_e164(phone_input text, country_input text DEFAULT 'United States'::text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  country_code_val text;
  digits text;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;
  
  country_code_val := CASE
    WHEN country_input ILIKE '%united states%' OR country_input ILIKE '%usa%' OR country_input ILIKE '%us%' THEN '1'
    WHEN country_input ILIKE '%canada%' THEN '1'
    WHEN country_input ILIKE '%united kingdom%' OR country_input ILIKE '%uk%' THEN '44'
    WHEN country_input ILIKE '%germany%' THEN '49'
    WHEN country_input ILIKE '%france%' THEN '33'
    WHEN country_input ILIKE '%australia%' THEN '61'
    WHEN country_input ILIKE '%japan%' THEN '81'
    WHEN country_input ILIKE '%netherlands%' THEN '31'
    WHEN country_input ILIKE '%singapore%' THEN '65'
    WHEN country_input ILIKE '%switzerland%' THEN '41'
    WHEN country_input ILIKE '%spain%' THEN '34'
    WHEN country_input ILIKE '%italy%' THEN '39'
    WHEN country_input ILIKE '%sweden%' THEN '46'
    WHEN country_input ILIKE '%norway%' THEN '47'
    WHEN country_input ILIKE '%denmark%' THEN '45'
    WHEN country_input ILIKE '%finland%' THEN '358'
    WHEN country_input ILIKE '%belgium%' THEN '32'
    WHEN country_input ILIKE '%austria%' THEN '43'
    WHEN country_input ILIKE '%ireland%' THEN '353'
    WHEN country_input ILIKE '%new zealand%' THEN '64'
    WHEN country_input ILIKE '%south africa%' THEN '27'
    WHEN country_input ILIKE '%india%' THEN '91'
    WHEN country_input ILIKE '%china%' THEN '86'
    WHEN country_input ILIKE '%brazil%' THEN '55'
    WHEN country_input ILIKE '%mexico%' THEN '52'
    ELSE '1'
  END;
  
  digits := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
  
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  
  IF NOT digits ~ ('^' || country_code_val) THEN
    digits := country_code_val || digits;
  END IF;
  
  RETURN '+' || digits;
END;
$function$;

-- Fix normalize_country_value (if exists)
CREATE OR REPLACE FUNCTION public.normalize_country_value(country_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  IF country_input IS NULL OR country_input = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN CASE
    WHEN country_input ILIKE '%united states%' OR country_input ILIKE '%usa%' OR country_input = 'US' THEN 'United States'
    WHEN country_input ILIKE '%united kingdom%' OR country_input ILIKE '%uk%' OR country_input = 'GB' THEN 'United Kingdom'
    WHEN country_input ILIKE '%canad%' OR country_input = 'CA' THEN 'Canada'
    WHEN country_input ILIKE '%german%' OR country_input = 'DE' THEN 'Germany'
    WHEN country_input ILIKE '%franc%' OR country_input = 'FR' THEN 'France'
    WHEN country_input ILIKE '%austral%' OR country_input = 'AU' THEN 'Australia'
    WHEN country_input ILIKE '%japan%' OR country_input = 'JP' THEN 'Japan'
    WHEN country_input ILIKE '%netherland%' OR country_input = 'NL' THEN 'Netherlands'
    WHEN country_input ILIKE '%singapore%' OR country_input = 'SG' THEN 'Singapore'
    ELSE country_input
  END;
END;
$function$;

-- Fix trigger_normalize_country
CREATE OR REPLACE FUNCTION public.trigger_normalize_country()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country_value(NEW.country);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix update_ai_agents_updated_at
CREATE OR REPLACE FUNCTION public.update_ai_agents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix calculate_next_run (if exists)
CREATE OR REPLACE FUNCTION public.calculate_next_run(schedule text, last_run timestamp with time zone DEFAULT now())
RETURNS timestamp with time zone
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  RETURN CASE schedule
    WHEN 'hourly' THEN last_run + interval '1 hour'
    WHEN 'daily' THEN last_run + interval '1 day'
    WHEN 'weekly' THEN last_run + interval '1 week'
    WHEN 'monthly' THEN last_run + interval '1 month'
    ELSE last_run + interval '1 day'
  END;
END;
$function$;
