
# Phase 3: System Cleanup - Implementation Plan

## Overview

This plan deletes 20+ legacy edge functions that have been superseded by `enrich-unified`, updates the `supabase/config.toml`, and refactors frontend components to use the unified API. This will remove approximately 10,000+ lines of legacy code.

---

## Summary of Changes

| Category | Count | Impact |
|----------|-------|--------|
| Edge Functions to Delete | 22 folders | ~10,000 lines removed |
| Config Entries to Remove | 24 entries | Cleaner config.toml |
| Frontend Files to Update | 6 files | Migrate to enrich-unified |
| Deprecated Config Entries | 2 entries | Non-existent functions |

---

## Part 1: Frontend Migration (Update Before Deleting)

Before deleting edge functions, we must update frontend components that still reference them.

### 1.1 Files That Need Migration

| File | Current Call | Migrate To |
|------|--------------|------------|
| `EnrichmentJobMonitor.tsx` | `enrich-ai-only` | `enrich-unified` |
| `ProactiveInsightsWidget.tsx` | `enrich-ai-only` | `enrich-unified` |
| `SmartEnrichmentPanel.tsx` | `enrich-ai-only` | `enrich-unified` |
| `UnifiedInsightsPanel.tsx` | `enrich-ai-only` | `enrich-unified` |
| `LeadEnrichmentPanel.tsx` | `enrichment-orchestrator` | `enrich-unified` |
| `BulkLeadEnrichment.tsx` | `enrichment-orchestrator` | `enrich-unified` |
| `LeadDiscovery.tsx` | `enrich-contacts-bulk` | `enrich-unified` |
| `InstantEnrich.tsx` | `enrich-single-company`, `enrich-with-firecrawl` | `enrich-unified` |
| `SparseDataDiscovery.tsx` | `enrich-discover` | `enrich-unified` |
| `EnrichmentTester.tsx` | `enrich-clearbit-free`, `enrich-firmographics` | `enrich-unified` |
| `APIAccess.tsx` | References `enrich-single-company`, `enrich-free-orchestrator` | Update docs to `enrich-unified` |
| `BulkAccountEnrichment.tsx` | Log link to `smart-enrich` | Update to `enrich-unified` |

---

## Part 2: Edge Functions to Delete

### 2.1 Safe to Delete (No Frontend References)

These functions have no remaining frontend invocations:

| Function | Lines | Reason for Deletion |
|----------|-------|---------------------|
| `deep-enrich-contact/` | ~220 | Superseded by unified waterfall |
| `enrich-v4/` | ~560 | Old version, replaced by unified |
| `enrich-person/` | ~200 | Waterfall handles person enrichment |
| `enrich-contact-info/` | ~150 | Merged into unified |
| `enrich-lead-slim/` | ~180 | Unified handles all lead modes |
| `enrich-gemini-account/` | ~250 | Multi-provider replaces single provider |
| `enrich-gemini-phones/` | ~200 | Phone discovery in unified |
| `enrich-perplexity/` | ~300 | Used internally by waterfall only |
| `enrich-perplexity-contact/` | ~250 | Merged into unified |
| `enrich-verified/` | ~180 | Hunter verification in unified |
| `enrich-fast/` | ~200 | Fast mode available in unified config |
| `enrich-with-firecrawl/` | Does not exist (orphan config) | Config only, no folder |
| `enrich-accounts/` | Does not exist (orphan config) | Config only, no folder |
| `smart-enrich/` | Does not exist (orphan config) | Config only, no folder |
| `process-enrichment/` | Does not exist (orphan config) | Config only, no folder |
| `enrich-from-master/` | Does not exist (orphan config) | Config only, no folder |
| `bulk-enrich-all-accounts/` | Does not exist (orphan config) | Config only, no folder |
| `enrich-lead-test/` | Does not exist (orphan config) | Config only, no folder |
| `enrich-lead-orchestrator/` | Does not exist (orphan config) | Config only, no folder |

### 2.2 Delete After Frontend Migration

These will be safe to delete once frontend is migrated:

| Function | Lines | Current References |
|----------|-------|-------------------|
| `enrich-ai-only/` | ~870 | 5 components (migrate first) |
| `enrichment-orchestrator/` | ~400 | 2 components (migrate first) |
| `enrich-contacts-bulk/` | ~350 | 2 components (migrate first) |
| `enrich-discover/` | ~300 | 1 component (migrate first) |
| `enrich-single-company/` | ~250 | 2 components (migrate first) |
| `enrich-clearbit-free/` | ~200 | 1 component (migrate first) |
| `enrich-firmographics/` | ~300 | 1 component (migrate first) |
| `enrich-free-orchestrator/` | ~400 | 1 component (migrate first) |
| `enrich-free-worker/` | ~350 | Internal to free-orchestrator |
| `process-enrichment-queue/` | ~300 | No frontend refs, queue remnant |

---

## Part 3: Functions to KEEP

These functions are still actively used or provide unique functionality:

| Function | Reason to Keep |
|----------|----------------|
| `enrich-unified/` | **Core unified API** - primary enrichment entry point |
| `enrich-pdl/` | Called by waterfall internally |
| `enrich-tech-stack/` | Specialized tech stack discovery |
| `enrich-technology-insights/` | Specialized technology analysis |
| `enrich-hq-address/` | Specialized HQ address lookup |
| `enrich-contacts-persona/` | Persona-specific enrichment |
| `enrich-ai-firmographics/` | AI firmographics (review for merge) |
| `enrich-test-accuracy/` | QA testing function |
| `firecrawl-scrape/` | General-purpose web scraping utility |
| `discover-contacts/` | New contact discovery bridge |
| `discover-domain/` | Domain discovery utility |
| `chrome-extension-enrich/` | Chrome extension support |

---

## Part 4: Config.toml Cleanup

Remove these 24 entries from `supabase/config.toml`:

```
[functions.enrich-lead-slim]         # Delete
[functions.enrich-lead-orchestrator] # Orphan - no folder exists
[functions.enrich-person]            # Delete
[functions.enrich-contact-info]      # Delete
[functions.enrich-firmographics]     # Delete after migration
[functions.enrich-lead-test]         # Orphan - no folder exists
[functions.enrich-accounts]          # Orphan - no folder exists
[functions.enrich-contacts-bulk]     # Delete after migration
[functions.enrich-clearbit-free]     # Delete after migration
[functions.smart-enrich]             # Orphan - no folder exists
[functions.process-enrichment]       # Orphan - no folder exists
[functions.deep-enrich-contact]      # Delete
[functions.enrichment-orchestrator]  # Delete after migration
[functions.bulk-enrich-all-accounts] # Orphan - no folder exists
[functions.enrich-from-master]       # Orphan - no folder exists
[functions.enrich-ai-only]           # Delete after migration
[functions.enrich-verified]          # Delete
[functions.enrich-fast]              # Delete
[functions.enrich-gemini-phones]     # Delete
[functions.enrich-perplexity-contact]# Delete
[functions.enrich-gemini-account]    # Delete
[functions.enrich-discover]          # Delete after migration
[functions.process-enrichment-queue] # Delete
[functions.enrich-v4]                # Delete
[functions.enrich-free-worker]       # Delete
[functions.enrich-free-orchestrator] # Delete after migration
[functions.enrich-perplexity]        # Delete
[functions.enrich-single-company]    # Delete after migration
```

---

## Implementation Steps

### Step 1: Migrate Frontend Components

Update these 9 files to use `enrich-unified`:

1. **EnrichmentJobMonitor.tsx** - Change `enrich-ai-only` to `enrich-unified`
2. **ProactiveInsightsWidget.tsx** - Change `enrich-ai-only` to `enrich-unified`
3. **SmartEnrichmentPanel.tsx** - Change `enrich-ai-only` to `enrich-unified`
4. **UnifiedInsightsPanel.tsx** - Change `enrich-ai-only` to `enrich-unified`
5. **LeadEnrichmentPanel.tsx** - Change `enrichment-orchestrator` to `enrich-unified`
6. **BulkLeadEnrichment.tsx** - Change `enrichment-orchestrator` to `enrich-unified`
7. **LeadDiscovery.tsx** - Change `enrich-contacts-bulk` to `enrich-unified`
8. **InstantEnrich.tsx** - Change `enrich-single-company` and `enrich-with-firecrawl` to `enrich-unified`
9. **SparseDataDiscovery.tsx** - Change `enrich-discover` to `enrich-unified`
10. **EnrichmentTester.tsx** - Update provider mappings to use `enrich-unified`
11. **APIAccess.tsx** - Update API documentation to reference `enrich-unified`
12. **BulkAccountEnrichment.tsx** - Update log link to `enrich-unified`

### Step 2: Delete Edge Function Folders

Delete these 22 folders from `supabase/functions/`:

```
supabase/functions/deep-enrich-contact/
supabase/functions/enrich-v4/
supabase/functions/enrich-person/
supabase/functions/enrich-contact-info/
supabase/functions/enrich-lead-slim/
supabase/functions/enrich-gemini-account/
supabase/functions/enrich-gemini-phones/
supabase/functions/enrich-perplexity/
supabase/functions/enrich-perplexity-contact/
supabase/functions/enrich-verified/
supabase/functions/enrich-fast/
supabase/functions/enrich-ai-only/
supabase/functions/enrichment-orchestrator/
supabase/functions/enrich-contacts-bulk/
supabase/functions/enrich-discover/
supabase/functions/enrich-single-company/
supabase/functions/enrich-clearbit-free/
supabase/functions/enrich-firmographics/
supabase/functions/enrich-free-orchestrator/
supabase/functions/enrich-free-worker/
supabase/functions/process-enrichment-queue/
```

### Step 3: Update supabase/config.toml

Remove all deprecated function entries and clean up the configuration file.

---

## Request Body Migration Guide

When migrating from legacy functions to `enrich-unified`, use this format:

**Old (enrich-ai-only):**
```typescript
supabase.functions.invoke('enrich-ai-only', {
  body: { jobId, batchSize: 100 }
});
```

**New (enrich-unified):**
```typescript
supabase.functions.invoke('enrich-unified', {
  body: { 
    job_id: jobId, 
    org_id: userProfile?.org_id,
    record_type: 'account',
    records: [],
    config: { aggregateProviders: true }
  }
});
```

---

## Expected Outcomes

1. **~10,000 lines of legacy code removed** from edge functions
2. **24 config entries removed** from config.toml
3. **Single enrichment entry point** - all enrichment goes through `enrich-unified`
4. **Consistent API** across all enrichment operations
5. **Easier maintenance** with fewer functions to manage
6. **Reduced deployment time** with smaller codebase

---

## Risk Mitigation

- Frontend migration happens BEFORE function deletion
- Each migration can be tested independently
- Unified function already handles all enrichment modes
- Rollback: functions can be restored from git if needed
