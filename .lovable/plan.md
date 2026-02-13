

# Fix AI ICP Generation for 91.life

## Root Cause

The "AI ICP Builder" button on the ICP Manager page calls `generate-icp-recommendations`, which only produces action-item recommendations (e.g., "Define your ICP", "Sync data sources") -- it never actually creates an ICP profile. The function that CAN create ICPs from documents (`parse-icp-document`) is only accessible from the Admin Customer Onboarding dialog.

Additionally, the existing ICP for Ninety One Life contains incorrect data (Financial Services / Asset Management) because it was parsed as Ninety One (the investment firm), not 91.life (the health/longevity platform).

## What Will Change

### 1. Add Document-Based ICP Creation to ICP Manager

Add a dialog (similar to the AI Customer Onboarding dialog) directly on the ICP Manager page so users can paste or upload ICP documents and generate a proper ICP profile without going through Admin > Customer Onboarding.

- New component: `src/components/icp/AIICPBuilderDialog.tsx`
- Accepts company name (pre-filled from org), document text (paste or PDF upload), and optional website URL
- Calls `parse-icp-document` with the current org_id so the ICP is created under the right organization
- On success, refreshes the ICP list and opens the new ICP detail view

### 2. Update the "AI ICP Builder" Button

Change the ICP Manager's "AI ICP Builder" button to open this new dialog instead of calling `generate-icp-recommendations`.

- File: `src/pages/ICPManager.tsx`
- Replace `handleAIRecommendations()` with dialog open state

### 3. Fix the Existing Wrong ICP Data

Update the `parse-icp-document` edge function to handle the case where an org already has an ICP with `template_source = 'ai-parsed'` -- instead of always inserting a new one, offer to update or replace the existing one.

### 4. Populate Onboarding Config

When `parse-icp-document` creates an ICP, also update the `org_onboarding_config` row with the extracted `value_proposition` (from the ICP description) and `target_persona_description` (from extracted persona titles). This ensures that future AI recommendations have context.

## Technical Details

### New File: `src/components/icp/AIICPBuilderDialog.tsx`
- Reuses the same PDF parsing logic from `AICustomerOnboardingDialog` (pdfjs-dist client-side extraction)
- Pre-fills company name from the current organization
- Calls `parse-icp-document` with `{ document_text, company_name, website_url, org_id }` -- passing `org_id` explicitly so it doesn't create a new org
- Shows loading state while AI processes
- On success, triggers ICP list refresh and navigates to the new ICP

### Modified File: `src/pages/ICPManager.tsx`
- Import and render `AIICPBuilderDialog`
- Replace `handleAIRecommendations` with a simple `setAiBuilderOpen(true)` toggle
- Add callback to refresh ICPs and select the new one after creation

### Modified File: `supabase/functions/parse-icp-document/index.ts`
- After creating the ICP, also upsert `org_onboarding_config.value_proposition` and `target_persona_description` from the extracted data (only if currently empty)
- This ensures the onboarding context is populated for downstream AI features

### Data Fix
- Delete or update the existing incorrect ICP (`207c6c62-...`) for Ninety One Life
- The user can then re-upload the correct 91.life documents through the new dialog

## User Flow After Fix

1. Go to ICP Manager for Ninety One Life
2. Click "AI ICP Builder"
3. Dialog opens with company name pre-filled as "Ninety One Life"
4. Upload the PDF or paste document content
5. Click "Generate ICP"
6. AI extracts all fields (industries: Health/Wellness/Fitness, geographies: US/Canada/UK, personas: CPO/VP HR/Benefits Manager, etc.)
7. ICP profile is created and displayed immediately

