

# Fix AI ICP for 91.life (Healthcare Company)

## Problems Found

There are three issues causing wrong ICP data:

### 1. Wrong Existing ICP Data
The current ICP profile for 91.life (id: `207c6c62-...`) contains Financial Services / Asset Management data from "Ninety One" (the investment firm). This needs to be deleted so the correct healthcare-focused ICP can be generated.

### 2. AI ICP Assistant Shows Wrong Data
The "AI ICP Assistant" panel (the one showing Business Services, Finance, Construction) queries the `accounts` table which contains your uploaded ZoomInfo reference data (general B2B companies). It does NOT look at 91.life's uploaded ICP documents at all. This panel needs to also incorporate the org's onboarding config and existing ICP data so it knows 91.life sells into healthcare.

### 3. Empty Onboarding Context
The `org_onboarding_config` for 91.life has blank `value_proposition` and `target_persona_description`. Without this context, the AI has no idea that 91.life is a health/longevity platform selling into healthcare.

## What Will Change

### Step 1: Delete the Wrong ICP
Remove the incorrect "Ninety One Life - Primary ICP" (Financial Services) profile so it does not confuse future AI calls.

### Step 2: Update Onboarding Config
Populate 91.life's `org_onboarding_config` with the correct context from the uploaded documents:
- `value_proposition`: Health and longevity platform helping employers reduce healthcare costs through preventive wellness programs
- `target_persona_description`: CPO, VP HR, Benefits Manager, Wellness Director at mid-to-large employers in Healthcare, Insurance, and Corporate Wellness

### Step 3: Fix the AI ICP Assistant Panel
Update `generate-icp-recommendations` edge function to filter the `accounts` table by the org's existing ICP criteria (industries from icp_profiles) rather than showing raw top-3 from all accounts. When an ICP exists with specific industries like Healthcare, the data insights should reflect healthcare accounts, not all 14k generic companies.

### Step 4: Prevent Duplicate ICPs on Re-parse
Update `parse-icp-document` to check for an existing `ai-parsed` ICP for the same org and UPDATE it instead of creating a duplicate. This way re-uploading documents fixes the ICP in place.

## Technical Details

### Data Fix (one-time)
- Delete ICP `207c6c62-9d9d-4ba8-af1c-f997066baa01` (wrong Financial Services data)
- Update `org_onboarding_config` for org `cd592f73-...` with correct value_proposition and target_persona_description

### Edge Function: `generate-icp-recommendations` 
- After fetching `accounts`, also fetch the org's active `icp_profiles` industries
- If ICP industries exist, filter the account analysis to only show accounts matching those industries (or at minimum, include ICP context prominently in the AI prompt)
- Pass the `onboarding_config.value_proposition` to the AI so it understands the company sells into healthcare, not financial services

### Edge Function: `parse-icp-document`
- Before inserting, check if an ICP with `template_source = 'ai-parsed'` already exists for that org
- If yes, UPDATE the existing row instead of INSERT
- This prevents duplicate ICPs when re-uploading corrected documents

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-icp-recommendations/index.ts` | Filter account analysis by ICP industries; pass value_proposition context |
| `supabase/functions/parse-icp-document/index.ts` | Upsert instead of always insert for ai-parsed ICPs |

### After the Fix
1. The wrong Financial Services ICP is gone
2. Re-upload the 91.life PDF via AI ICP Builder
3. New ICP is created with Healthcare, Insurance, Corporate Wellness industries
4. The AI ICP Assistant panel will show healthcare-relevant data insights instead of generic Business Services / Finance
