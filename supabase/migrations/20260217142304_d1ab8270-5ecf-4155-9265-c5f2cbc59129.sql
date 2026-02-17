-- Fix: master_account_data table has no RLS policies
-- This is global reference data, so we restrict all access to service_role only.
-- The enrich_accounts_from_master SECURITY DEFINER function is the intended
-- access path for regular users (it only enriches the caller's org accounts).

CREATE POLICY "Only service role can read master data"
  ON public.master_account_data FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can insert master data"
  ON public.master_account_data FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update master data"
  ON public.master_account_data FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete master data"
  ON public.master_account_data FOR DELETE
  USING (auth.role() = 'service_role');