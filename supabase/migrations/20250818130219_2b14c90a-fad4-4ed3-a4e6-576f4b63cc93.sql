-- Ensure RLS is enabled and properly secured on all critical tables

-- Double-check RLS is enabled on all tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Leads" ENABLE ROW LEVEL SECURITY;

-- Add additional security policies to ensure no public access
-- These are additional RESTRICTIVE policies to ensure security

CREATE POLICY "Block anonymous access to contacts" 
ON public.contacts 
FOR ALL 
TO anon 
USING (false);

CREATE POLICY "Block anonymous access to user_profiles" 
ON public.user_profiles 
FOR ALL 
TO anon 
USING (false);

CREATE POLICY "Block anonymous access to audit_logs" 
ON public.audit_logs 
FOR ALL 
TO anon 
USING (false);

-- Grant minimal permissions to authenticated role
REVOKE ALL ON public.contacts FROM authenticated;
REVOKE ALL ON public.user_profiles FROM authenticated;  
REVOKE ALL ON public.audit_logs FROM authenticated;

-- Only allow access through existing RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;