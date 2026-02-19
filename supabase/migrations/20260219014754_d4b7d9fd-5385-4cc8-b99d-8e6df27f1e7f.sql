
-- Recreate the dashboard_metrics_cache matview with >= 60 threshold for high-fit
DROP MATERIALIZED VIEW IF EXISTS dashboard_metrics_cache;

CREATE MATERIALIZED VIEW dashboard_metrics_cache AS
SELECT a.org_id,
    count(*) AS total_accounts,
    count(*) FILTER (WHERE a.data_source = ANY (ARRAY['crm'::text, 'both'::text, 'closed_won'::text])) AS total_crm_accounts,
    count(*) FILTER (WHERE a.data_source = 'database'::text) AS total_database_accounts,
    count(s.id) AS scored_accounts,
    count(s.id) FILTER (WHERE a.data_source = ANY (ARRAY['crm'::text, 'both'::text, 'closed_won'::text])) AS scored_crm_accounts,
    count(s.id) FILTER (WHERE a.data_source = 'database'::text) AS scored_database_accounts,
    count(s.id) FILTER (WHERE s.overall >= 60) AS high_fit_accounts,
    count(s.id) FILTER (WHERE s.overall >= 60 AND (a.data_source = ANY (ARRAY['crm'::text, 'both'::text, 'closed_won'::text]))) AS high_fit_crm_accounts,
    count(s.id) FILTER (WHERE s.overall >= 60 AND a.data_source = 'database'::text) AS high_fit_database_accounts,
    count(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 60) AS medium_fit_accounts,
    count(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 60 AND (a.data_source = ANY (ARRAY['crm'::text, 'both'::text, 'closed_won'::text]))) AS medium_fit_crm_accounts,
    count(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 60 AND a.data_source = 'database'::text) AS medium_fit_database_accounts,
    count(s.id) FILTER (WHERE s.overall < 40) AS low_fit_accounts,
    count(s.id) FILTER (WHERE s.overall < 40 AND (a.data_source = ANY (ARRAY['crm'::text, 'both'::text, 'closed_won'::text]))) AS low_fit_crm_accounts,
    count(s.id) FILTER (WHERE s.overall < 40 AND a.data_source = 'database'::text) AS low_fit_database_accounts,
    COALESCE(avg(s.overall), 0::numeric) AS avg_score,
    now() AS refreshed_at
FROM accounts a
    LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
GROUP BY a.org_id;

-- Create unique index for CONCURRENTLY refresh support
CREATE UNIQUE INDEX ON dashboard_metrics_cache (org_id);
