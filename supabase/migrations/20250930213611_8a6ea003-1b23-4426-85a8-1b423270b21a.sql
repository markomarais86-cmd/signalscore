-- Phase 1: Data Reality Reset
-- Clear all demo/fake data from the system

-- Delete demo accounts (the 10 sample accounts)
DELETE FROM public.accounts 
WHERE external_id IN ('ACC001', 'ACC002', 'ACC003', 'ACC004', 'ACC005', 'ACC006', 'ACC007', 'ACC008', 'ACC009', 'ACC010')
  OR name IN ('TechCorp Solutions', 'DataFlow Industries', 'CloudScale Systems', 'FinTech Innovations', 'RetailMax Group', 'HealthTech Partners', 'ManufacturingPro', 'EdTech Solutions', 'GreenEnergy Corp', 'LogisticsTech');

-- Delete demo contacts
DELETE FROM public.contacts 
WHERE external_id IN ('CONT001', 'CONT002', 'CONT003', 'CONT004', 'CONT005', 'CONT006', 'CONT007', 'CONT008', 'CONT009', 'CONT010');

-- Delete demo scores
DELETE FROM public.scores 
WHERE account_external_id IN ('ACC001', 'ACC002', 'ACC003', 'ACC004', 'ACC005');

-- Delete demo leads
DELETE FROM public."Leads" 
WHERE external_id IN ('LEAD001', 'LEAD002', 'LEAD003', 'LEAD004', 'LEAD005');

-- Delete fake external data sources
DELETE FROM public.external_data_sources 
WHERE provider IN ('zoominfo', 'apollo', 'cognism');

-- Reset any demo ICP profiles (keep user-created ones)
DELETE FROM public.icp_profiles 
WHERE name = 'Enterprise Technology Companies' 
  AND description = 'Mid-to-large technology companies with strong digital transformation initiatives';

-- Add comment to track data reset
COMMENT ON TABLE public.accounts IS 'All demo data cleared - system now shows true empty state until real data is uploaded';