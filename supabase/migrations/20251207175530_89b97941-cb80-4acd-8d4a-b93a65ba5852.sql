-- Truncate all historical failed_scores (16,200 records from Dec 4th)
TRUNCATE TABLE failed_scores;

-- Delete old failed enrichment jobs (keeping only recent ones)
DELETE FROM enrichment_jobs WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';

-- Also clean up any remaining auto_score_failures
TRUNCATE TABLE auto_score_failures;