-- Fix the 18 unlinked NHS leads with malformed www.www URLs
UPDATE "Leads" 
SET account_external_id = 'acc_1759317677592_3426_uyuks8s5a',
    updated_at = NOW()
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
  AND (account_external_id IS NULL OR account_external_id = '')
  AND website LIKE '%www.www.nhs.uk%';