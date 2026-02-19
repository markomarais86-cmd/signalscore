-- Reset false positive bed counts for non-healthcare companies
-- These accounts were incorrectly assigned bed counts by AI enrichment

UPDATE accounts
SET custom_attributes = jsonb_set(
  COALESCE(custom_attributes::jsonb, '{}'::jsonb),
  '{bed_count}',
  '0'::jsonb
)
WHERE id IN (
  '037e2d43-d5cd-4016-97e2-2760bc96e0cb',  -- 1543 Capital
  '7bfd8768-bff0-4055-84d3-c3aea59bc36b',  -- Acciona
  '0d4962ac-2f61-4c5c-975c-d49f92145702',  -- Adani
  'dd861e52-d893-4623-96b3-78dddb439edf',  -- AIG
  '6fae1e72-ef31-4cb7-8fe0-4c0b64ac76d3',  -- Al Jaber
  'e55c9efe-2fa6-4a6e-bcae-b17b97f1cbce',  -- Alleghany
  '0369244f-3409-4618-a64d-81c50f6757dd',  -- Allianz
  '7eee8ac3-a36b-4efc-a63a-bbf0ecaa022f',  -- Altice
  '3e074c7a-085c-44b7-85c5-f70c002e0fd7',  -- Anne Arundel County
  '7f1c69cf-32b3-43d3-98aa-339dad35d06a',  -- ArcelorMittal
  '8e96ac64-7b23-4acb-aeec-41615e869cee',  -- Artemis
  '825a8925-6407-4b03-8466-32c323fd827b',  -- Arvind
  '034b9208-5156-44f2-aba7-ddf5153060ff',  -- Auma
  'd57f2e81-d8fb-4076-b29b-19f7434e32d5',  -- Bahri
  '079aa91b-8d4b-41f1-9770-288803c66f3e'   -- Bank of Georgia Group
);