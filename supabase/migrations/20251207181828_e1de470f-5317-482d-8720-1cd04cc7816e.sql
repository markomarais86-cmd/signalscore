-- Fix function search paths for security
-- These functions are missing explicit search_path settings

-- Fix bulk_match_all_leads
ALTER FUNCTION public.bulk_match_all_leads(p_org_id uuid, p_batch_size integer) SET search_path = public, pg_temp;

-- Fix generate_sample_data
ALTER FUNCTION public.generate_sample_data() SET search_path = public, pg_temp;

-- Fix get_current_user_org_id
ALTER FUNCTION public.get_current_user_org_id() SET search_path = public, pg_temp;

-- Fix get_org_enrichment_credits
ALTER FUNCTION public.get_org_enrichment_credits(org_uuid uuid) SET search_path = public, pg_temp;

-- Fix has_role (uses app_role type)
ALTER FUNCTION public.has_role(_user_id uuid, _role app_role) SET search_path = public, pg_temp;

-- Fix is_current_user_admin
ALTER FUNCTION public.is_current_user_admin() SET search_path = public, pg_temp;

-- Fix normalize_domain_text
ALTER FUNCTION public.normalize_domain_text(domain_input text) SET search_path = public, pg_temp;

-- Fix prevent_duplicate_leads
ALTER FUNCTION public.prevent_duplicate_leads() SET search_path = public, pg_temp;