-- Clean up historical failed_scores records from Dec 4th
-- These are from when the scoring function had incorrect signature
DELETE FROM failed_scores WHERE created_at < NOW() - INTERVAL '3 days';

-- Also clean up any old auto_score_failures
DELETE FROM auto_score_failures WHERE created_at < NOW() - INTERVAL '3 days';