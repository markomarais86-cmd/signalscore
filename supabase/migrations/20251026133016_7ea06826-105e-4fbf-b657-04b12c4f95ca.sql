-- Fix circular dependency in user_profiles RLS
-- Allow users to view their own profile directly without needing org_id
CREATE POLICY "Users can view their own profile directly" 
ON public.user_profiles 
FOR SELECT 
USING (user_id = auth.uid());