-- Enable contact discovery in enrichment settings for existing orgs
INSERT INTO automation_settings (org_id, setting_key, enabled)
SELECT o.id, 'auto_discover_contacts', true 
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM automation_settings a
  WHERE a.org_id = o.id 
    AND a.setting_key = 'auto_discover_contacts'
)
ON CONFLICT DO NOTHING;