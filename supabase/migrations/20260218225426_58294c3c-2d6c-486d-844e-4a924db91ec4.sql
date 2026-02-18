-- Expand ICP revenue_ranges to match actual data formats
UPDATE icp_profiles 
SET revenue_ranges = ARRAY[
  '$100M-$250M', '$100M-$500M', '$100M - $250M', '$100M to <$1B',
  '$250M-$500M', '$250M - $500M',
  '$500M-$1B', '$500M-1B', '$500M - $1B',
  '$1B-$5B', '$1B+', '$1B-$10B', '$1B - $10B',
  '$5B+', '$10B+'
]
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';