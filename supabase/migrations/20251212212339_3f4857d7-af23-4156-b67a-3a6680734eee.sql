-- Create a test enrichment job for 25 accounts
INSERT INTO enrichment_jobs (
  org_id,
  job_type,
  provider,
  status,
  batch_size,
  total_records,
  processed_records,
  enriched_records,
  failed_records,
  created_at
) VALUES (
  '726a0dc0-99c7-43c2-b20f-b849f2760c3f',
  'accounts',
  'smart-waterfall',
  'pending',
  25,
  25,
  0,
  0,
  0,
  now()
);