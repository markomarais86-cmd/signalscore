-- Drop the old single-parameter geography function to fix overloading conflict
-- This ensures the new 2-parameter version with CTE logic is always used
DROP FUNCTION IF EXISTS public.get_geography_distribution(uuid);

-- The 2-parameter version with CTE logic remains and handles all cases
-- It will now be called even with 1 parameter (using default 'all')