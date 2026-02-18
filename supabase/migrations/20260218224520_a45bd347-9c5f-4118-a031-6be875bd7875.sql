UPDATE accounts 
SET custom_attributes = custom_attributes - 'bed_count' || '{"bed_count": null}'::jsonb
WHERE custom_attributes->>'bed_count' = 'Not applicable';