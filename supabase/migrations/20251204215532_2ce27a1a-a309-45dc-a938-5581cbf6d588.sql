-- Enable RLS on master_account_data
ALTER TABLE public.master_account_data ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read master data (it's reference data)
CREATE POLICY "Anyone can read master data"
ON public.master_account_data
FOR SELECT
USING (true);

-- Only admins can insert/update/delete master data
CREATE POLICY "Admins can insert master data"
ON public.master_account_data
FOR INSERT
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update master data"
ON public.master_account_data
FOR UPDATE
USING (is_current_user_admin());

CREATE POLICY "Admins can delete master data"
ON public.master_account_data
FOR DELETE
USING (is_current_user_admin());