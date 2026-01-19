-- First, delete duplicate leads keeping only the one with the most data (most recently enriched or most fields)
-- Using a CTE to identify duplicates and delete them
WITH ranked_leads AS (
  SELECT id, org_id, email,
    ROW_NUMBER() OVER (
      PARTITION BY org_id, email 
      ORDER BY 
        enriched_at DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) as rn
  FROM "Leads"
  WHERE email IS NOT NULL
)
DELETE FROM "Leads"
WHERE id IN (
  SELECT id FROM ranked_leads WHERE rn > 1
);

-- Now add the unique constraint
CREATE UNIQUE INDEX leads_org_email_unique 
ON public."Leads" (org_id, email) 
WHERE email IS NOT NULL;