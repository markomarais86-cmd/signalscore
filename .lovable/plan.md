

## Fix: Edit Data Toggle Button Not Working in Bulk Attribute Editor

### The Problem

Clicking the "Edit Data" button on the Healthcare (or any) vertical card does nothing -- the BulkAttributeEditor table never appears. The button's `onClick` calls `setEditDataCategory(prev => prev === category ? null : category)`, but the state change doesn't produce a visual result. No accounts query fires, confirming the `BulkAttributeEditor` component never mounts.

### Root Cause Investigation

The button is inside a `CardHeader` which is inside a `Card`. The state setter fires, but something causes the component to re-render and reset. Looking at the code structure:

1. The `loadDefinitions` function (line 272) sets `setLoading(true)`, which causes the render path to switch to the loading skeleton (line 593-596), unmounting all cards
2. If `loadDefinitions` is called during or after the state change, the cards unmount and remount -- losing the `editDataCategory` state visually (it gets set but then the loading branch renders instead)
3. The `useEffect` on line 226 depends on `[dataOrgId, effectiveOrgId]`. If the `useDataOrgId` hook's React Query resolves asynchronously after the tab renders, it could re-trigger `loadDefinitions`, causing a flash of loading state

However, the most likely cause is simpler: **the button click works, but `dataOrgId` might momentarily be null** during a React Query refetch cycle, causing the condition `editDataCategory === category && dataOrgId` (line 693) to be false even when `editDataCategory` is set.

### The Fix

**File: `src/components/settings/CustomAttributeManager.tsx`**

1. **Prevent `loadDefinitions` from resetting loading state on refetch** -- Only set `loading: true` on initial load, not on subsequent re-fetches. This prevents cards from unmounting.

2. **Use `dataOrgId` fallback** -- Cache the last known `dataOrgId` so a momentary `null` during refetch doesn't hide the editor.

3. **Add a guard to prevent re-calling `loadDefinitions`** -- Once definitions are loaded, don't call it again unless the org actually changes.

```typescript
// Change 1: Only show loading skeleton on initial load
const [initialLoading, setInitialLoading] = useState(true);

const loadDefinitions = async () => {
  if (!dataOrgId) return;
  // Only show full loading skeleton on first load
  if (definitions.length === 0) setLoading(true);
  try {
    // ... existing query
  } finally {
    setLoading(false);
    setInitialLoading(false);
  }
};

// Change 2: In the useEffect, track whether we've loaded for this org
const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);

useEffect(() => {
  if (dataOrgId && dataOrgId !== loadedOrgId) {
    setLoadedOrgId(dataOrgId);
    loadDefinitions();
    // ... ICP fetch
  }
}, [dataOrgId, effectiveOrgId]);

// Change 3: Use initialLoading for the skeleton guard
{initialLoading ? (
  <Card><CardContent>Loading...</CardContent></Card>
) : definitions.length === 0 ? (
  // ...empty state
) : (
  // ...render cards with Edit Data
)}
```

### Expected Result

- Clicking "Edit Data" toggles the bulk editor table inline below the attribute list
- The "Missing" filter dropdown shows field options (e.g., "Missing Number of Beds")
- Selecting "Missing Number of Beds" shows the 663 healthcare accounts that still need `bed_count` values
- The "Enrich Filtered" button appears next to the dropdown for targeted enrichment

### Data Summary (from database)

- 663 healthcare accounts still missing `bed_count`
- 20 accounts already have `bed_count` populated
- Total accounts in org: 39,928

