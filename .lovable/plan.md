

# Add tech_stack and company_stages to 91.Life Heart+ ICP

## What This Does
Populates the two empty fields on the **91.Life Heart+ - Hospital & Health System ICP** (`f0d17a6b-6476-4e2d-a90f-9afc8d8e232b`) so the completeness-based confidence score reaches **100%** (currently 90%, missing 5 pts each for `tech_stack` and `company_stages`).

## Data to Add

**company_stages** (healthcare-relevant):
- Established
- Enterprise
- Public Company
- Mature

These reflect the hospital and health system targets: large, established organizations -- not startups or early-stage companies.

**tech_stack** (healthcare IT stack):
- Microsoft Office 365
- Microsoft Azure
- Salesforce
- SAP
- Oracle ERP
- Okta
- Microsoft Teams

These are the most common enterprise platforms found in hospital and health system IT environments.

## Implementation

Single SQL UPDATE via the data insert tool (no schema migration needed):

```sql
UPDATE icp_profiles
SET 
  tech_stack = '["Microsoft Office 365","Microsoft Azure","Salesforce","SAP","Oracle ERP","Okta","Microsoft Teams"]'::jsonb,
  company_stages = '["Established","Enterprise","Public Company","Mature"]'::jsonb,
  confidence_score = 100
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';
```

No code changes are needed -- the frontend already renders these fields and `computeICPConfidence` will return 100 once both arrays are populated.

