-- Fix search_path for the bulk scoring jobs trigger function
CREATE OR REPLACE FUNCTION update_bulk_scoring_jobs_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;