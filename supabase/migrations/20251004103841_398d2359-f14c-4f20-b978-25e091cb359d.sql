-- Update ICP to include Professional Services and smaller companies
UPDATE public.icp_profiles
SET 
  industries = ARRAY[
    'Technology',
    'Software',
    'Financial Services',
    'Healthcare',
    'Manufacturing',
    'Education',
    'Media & Entertainment',
    'Telecommunications',
    'Energy & Utilities',
    'Business Services',
    'Professional Services',
    'IT Services',
    'Consulting'
  ],
  company_sizes = ARRAY[50, 100, 200, 500, 1000, 2000, 5000, 10000],
  revenue_ranges = ARRAY[
    '$1M-$5M',
    '$5M-$10M',
    '$10M-$25M',
    '$25M-$50M',
    '$50M-$100M',
    '$100M-$500M',
    '$500M-$1B',
    '$1B-$5B',
    '$5B+'
  ]
WHERE id = 'd5c7eca2-66f9-4dd3-995d-e26fb8c3fe1d';