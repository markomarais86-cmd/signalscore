-- Enable contact discovery for the organization
INSERT INTO automation_settings (org_id, setting_key, enabled)
VALUES ('726a0dc0-99c7-43c2-b20f-b849f2760c3f', 'contact_discovery', true)
ON CONFLICT (org_id, setting_key) DO UPDATE SET enabled = true;

-- Reset the stalled job with contact discovery enabled
UPDATE enrichment_jobs 
SET enable_contact_discovery = true,
    status = 'pending',
    paused_at = NULL,
    cursor = NULL,
    processed_records = 0,
    accounts_enriched = 0,
    fields_enriched = 0,
    enriched_records = 0,
    failed_records = 0,
    error_message = NULL,
    recovery_count = 0
WHERE id = '77850744-c09f-4f69-bc5a-4c6d0836e95d';