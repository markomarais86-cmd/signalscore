

# Implementation Plan: Tasks 4 & 5 - Background Exports and CRM Setup Wizards

## Overview
This plan completes the remaining GTM readiness fixes: background export infrastructure for large datasets and guided CRM setup wizards.

---

## Task 4: Background Export for Large Datasets

### Problem
The current export buttons (`ExportAccountsButton.tsx`, `ExportLeadsButton.tsx`) process all data client-side, which causes browser freezes for datasets exceeding 5,000 records.

### Solution
Add a threshold check that offers background processing for large exports.

### Files to Create

#### 1. Edge Function: `supabase/functions/export-csv/index.ts`
A background export processor that:
- Accepts export parameters (type, filter, org_id, user_id)
- Creates an `export_jobs` record with status "processing"
- Uses `EdgeRuntime.waitUntil()` for background processing
- Fetches data in batches (1,000 records at a time to avoid memory issues)
- Generates CSV content and stores it in Supabase Storage
- Updates the job with download URL when complete
- Handles errors gracefully and updates job status

#### 2. Shared Dialog Component: `src/components/enrichment/LargeExportDialog.tsx`
A dialog that appears when export exceeds 5,000 records:
- Shows record count warning
- Two options: "Download Now" (client-side) or "Export in Background" (server-side)
- Visual explanation of the tradeoff

### Files to Modify

#### 1. `src/components/enrichment/ExportAccountsButton.tsx`
Changes:
- Add a pre-flight count query before export
- If count > 5,000, show `LargeExportDialog` instead of immediate download
- Add `startBackgroundExport()` function that calls the edge function
- Keep existing client-side export for "Download Now" option

#### 2. `src/components/enrichment/ExportLeadsButton.tsx`
Same changes as ExportAccountsButton.

#### 3. `src/components/ExportQueueManager.tsx`
Changes:
- Subscribe to `export_jobs` table instead of `campaign_snapshots`
- Show real-time progress for pending/processing jobs
- Add download button for completed jobs
- Show error state for failed jobs

### Database (Already Created)
The `export_jobs` table was created in the previous session with:
- `id`, `org_id`, `user_id`, `export_type`, `status`
- `filter_params`, `total_records`, `processed_records`
- `filename`, `download_url`, `created_at`, `completed_at`, `error_message`

### Storage Bucket
Create a storage bucket `exports` for storing generated CSV files with:
- RLS policy: users can only download files for their org
- Auto-expiration after 7 days (optional)

---

## Task 5: CRM Setup Wizards

### Problem
Salesforce requires finding a security token (hidden in personal settings), and HubSpot requires creating a Developer App - too many external steps with no guidance.

### Solution
Replace the basic credential forms with step-by-step wizards that include inline instructions.

### Files to Create

#### 1. `src/components/settings/SalesforceSetupWizard.tsx`
A multi-step wizard component:

**Step 1: Get Your Security Token**
- Collapsible section with detailed instructions
- Screenshot or diagram showing where to find the token
- "I have my token" checkbox to proceed

**Step 2: Enter Your Credentials**
- Instance URL input with example and validation
- Username input
- Password input
- Security Token input
- "Test Connection" button with real-time feedback

**Step 3: Configure Sync Settings**
- Sync frequency dropdown
- Object selection (Accounts, Contacts, Opportunities)
- Success state with "Save & Connect" button

Features:
- Progress indicator showing current step
- Collapsible troubleshooting tips
- Clear error messages with suggested fixes
- Visual checkmarks for completed steps

#### 2. `src/components/settings/HubSpotSetupWizard.tsx`
A multi-step wizard component:

**Step 1: Create HubSpot Private App**
- Link to HubSpot Developer Portal
- Required scopes displayed in copyable format
- Screenshot/diagram of the setup process
- "I've created my app" checkbox to proceed

**Step 2: Enter App Credentials**
- Access Token input (for Private Apps)
- Alternative: Client ID/Secret for OAuth flow
- "Test Connection" button

**Step 3: Authorize & Configure**
- Sync frequency settings
- Object selection
- Success confirmation

Features:
- Clear explanation of Private App vs OAuth options
- Copyable scope list
- Inline validation

### Files to Modify

#### 1. `src/components/settings/IntegrationManager.tsx`
Changes:
- Replace the inline Salesforce credential form (lines 419-508) with `<SalesforceSetupWizard />`
- Replace the OAuth prompt for HubSpot (lines 415-417) with `<HubSpotSetupWizard />`
- Pass necessary props: `onSuccess`, `onCancel`, `orgId`, existing `config` if reconnecting
- Keep the existing sync/disconnect/field-mapping buttons unchanged

---

## Implementation Order

| Step | Task | Details |
|------|------|---------|
| 1 | Create `export-csv` edge function | Background processing with batch fetching |
| 2 | Create Supabase Storage bucket | For storing generated CSV files |
| 3 | Create `LargeExportDialog.tsx` | Threshold warning and option selection |
| 4 | Update `ExportAccountsButton.tsx` | Add count check and background option |
| 5 | Update `ExportLeadsButton.tsx` | Same updates as accounts |
| 6 | Update `ExportQueueManager.tsx` | Subscribe to export_jobs, show progress |
| 7 | Create `SalesforceSetupWizard.tsx` | Step-by-step Salesforce setup |
| 8 | Create `HubSpotSetupWizard.tsx` | Step-by-step HubSpot setup |
| 9 | Update `IntegrationManager.tsx` | Use wizards instead of basic forms |

---

## Technical Details

### Edge Function Pattern
Following the existing pattern in `enrich-v4`:
```text
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Start background task
  EdgeRuntime.waitUntil(processExport(jobId, params));
  
  // Return immediate response
  return new Response(JSON.stringify({ success: true, jobId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### Export Threshold
5,000 records chosen as the threshold based on:
- Typical browser memory limits for large string operations
- User patience thresholds (30+ seconds feels broken)
- Testing shows reliable client-side performance below this limit

### Wizard Component Structure
Each wizard uses:
- `useState` for current step tracking
- Collapsible sections from Radix UI
- Existing UI components (Input, Button, Badge)
- The existing `handleTestConnection` logic from IntegrationManager

### Real-time Updates
The ExportQueueManager already has Supabase Realtime patterns - we'll adapt these for the `export_jobs` table.

---

## Summary

| Task | New Files | Modified Files |
|------|-----------|----------------|
| **Background Exports** | `export-csv/index.ts`, `LargeExportDialog.tsx` | `ExportAccountsButton.tsx`, `ExportLeadsButton.tsx`, `ExportQueueManager.tsx` |
| **CRM Wizards** | `SalesforceSetupWizard.tsx`, `HubSpotSetupWizard.tsx` | `IntegrationManager.tsx` |

Total: 5 new files, 4 modified files

