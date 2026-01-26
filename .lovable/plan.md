
# GTM Readiness Fix Plan: 5 Critical Improvements

## Overview
This plan addresses five high-priority issues that could cause customer complaints post-launch. Each fix improves user experience and reduces support tickets.

---

## 1. Humanize Technical Error Messages

**Problem**: Multiple components display raw database errors like "violates foreign key constraint" or "PGRST116" directly to users.

**Solution**: Create a unified error toast helper that automatically applies the existing `friendlyErrorMessage` function, then update all identified components to use it.

### Files to Modify:
- `src/lib/friendly-errors.ts` - Add convenience wrapper for toasts
- `src/components/platform-admin/OrganizationManagementDialog.tsx`
- `src/hooks/use-infinite-accounts.tsx`
- `src/hooks/use-infinite-leads.tsx`
- `src/components/data-upload/BulkLeadMatcher.tsx`
- `src/components/executive/QuickCampaignButton.tsx`
- `src/components/campaigns/ApolloRedemptionDialog.tsx`
- `src/components/agents/ProactiveAgentSuggestions.tsx`
- `src/components/agents/AgentControlPanel.tsx`
- `src/components/settings/EnrichmentStatusCard.tsx`
- `src/components/settings/IntegrationManager.tsx`
- `src/components/settings/IntegrationCredentialManager.tsx`

### Changes:
1. Add a `toastError()` helper function to `friendly-errors.ts`:
```text
export function toastError(error: unknown, fallback = 'Operation failed') {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[Error]', error);
  return friendlyErrorMessage(message) || fallback;
}
```

2. Update catch blocks in all listed components to use the helper instead of raw `error.message`.

---

## 2. Simplify Sidebar Navigation (Updated)

**Problem**: The sidebar has 8+ main items plus 5 feature-flagged items - creating cognitive overload.

**Solution**: Group related items into 3 collapsible sections with AI Agents moved to Configure section.

### Files to Modify:
- `src/components/AppSidebar.tsx`

### New Structure:

| Section | Items | Behavior |
|---------|-------|----------|
| **Core** | Dashboard, Accounts, Leads | Always expanded, primary workflows |
| **Build** | ICP Manager, Enrichment | Collapsible, data building tools |
| **Configure** | AI Agents, Settings, Help | Collapsible, setup and configuration |
| **Analytics** | Pipeline Efficiency, Capital Efficiency, Reports, Segmentation, Trends | Feature-flagged items, collapsible |

### Changes:
1. Wrap navigation items in `SidebarGroup` components with labels
2. Add `Collapsible` behavior with auto-expansion when child route is active
3. Add visual separators between groups
4. Keep Admin item separate at bottom (super admin only)

---

## 3. Add Universal "Retry Failed Only" Button

**Problem**: Bulk operations lack consistent retry mechanisms for partial failures.

**Solution**: Create a reusable `RetryFailedButton` component and integrate it into bulk operation UIs.

### Files to Create:
- `src/components/shared/RetryFailedButton.tsx`

### Files to Modify:
- `src/components/settings/CRMSyncHistory.tsx`
- `src/components/settings/BulkAccountEnrichment.tsx`

### Component API:
```text
<RetryFailedButton
  failedCount={job.failed_records}
  onRetry={() => handleRetryFailed(job.id)}
  isRetrying={isRetrying}
/>
```

---

## 4. Implement Background Export for Large Datasets

**Problem**: CSV exports for 10K+ records freeze the browser or timeout.

**Solution**: Create server-side export with background processing.

### Files to Create:
- `supabase/functions/export-csv/index.ts`

### Files to Modify:
- `src/components/ExportQueueManager.tsx`
- `src/components/enrichment/ExportAccountsButton.tsx`
- `src/components/enrichment/ExportLeadsButton.tsx`

### Database Changes:
Create `export_jobs` table with: id, org_id, export_type, status, total_records, processed_records, filename, download_url, created_at, completed_at, error_message

### User Flow:
When export > 5,000 records, show dialog with options:
- "Download Now" - Client-side (with warning about performance)
- "Export in Background" - Server-side with notification when ready

---

## 5. Streamline CRM Setup with Guided Wizard

**Problem**: Salesforce and HubSpot setup requires complex external steps with no guidance.

**Solution**: Add inline step-by-step wizards with contextual help.

### Files to Create:
- `src/components/settings/SalesforceSetupWizard.tsx`
- `src/components/settings/HubSpotSetupWizard.tsx`

### Files to Modify:
- `src/components/settings/IntegrationManager.tsx`

### Salesforce Wizard Steps:
1. "Get Your Security Token" - collapsible instructions
2. Enter credentials with real-time validation
3. Test connection with clear success/error states

### HubSpot Wizard Steps:
1. "Create HubSpot App" - link to Developer Portal
2. Show required OAuth scopes (copyable)
3. Enter Client ID/Secret
4. Authorize and confirm

---

## Implementation Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Humanize Error Messages | Low | High |
| 2 | Sidebar Grouping | Low | Medium |
| 3 | Retry Failed Button | Medium | High |
| 4 | Background Exports | Medium | High |
| 5 | CRM Setup Wizards | Medium | High |

---

## Technical Notes

### Sidebar Implementation Details
- Uses existing `SidebarGroup` with `Collapsible` from Radix
- Auto-expansion logic checks if any child route matches current path
- Groups use `SidebarGroupLabel` for section headers
- Maintains existing icon-only collapsed mode

### Error Message Coverage
The `friendly-errors.ts` already maps:
- Database timeouts, RLS violations, constraint errors
- Network failures, edge function errors
- Auth errors, rate limiting

### Export Threshold
5,000 records chosen as threshold based on typical browser memory limits and user patience thresholds.
