-- Phase C: Production Optimization - Add database index for faster profile lookups
-- Add index on user_profiles.user_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Optimize the RLS policy for user_profiles to use the index efficiently
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;

-- Create optimized policy with better indexing hints
CREATE POLICY "Users can read their own profile" 
  ON user_profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Add a comment to document the optimization
COMMENT ON INDEX idx_user_profiles_user_id IS 'Optimizes profile lookups during authentication';
