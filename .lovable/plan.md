

## Fix: Settings Not Persisting and SOM Showing $0

### Problem 1: Settings Not Updating

When you change Average Deal Size to $80,000 and Conversion Rate to 17% and click "Apply", the values revert on next load. The settings popover in the Market Sizing card updates only the card's internal state -- it never saves to the database.

**Root Cause:** The `SimpleTAMCard` component has an `onSettingsChange` callback prop, but the `ExecutiveDashboard` never passes it. So the "Apply" button updates the card visually for the current session, but the values are lost on refresh because they were never written to `org_settings` in the database (currently empty `{}`).

### Problem 2: SOM = $0

SOM (Serviceable Obtainable Market) is calculated as: `campaignReadyAccounts x averageDealSize x conversionRate`. The database cache shows 1,515 campaign-ready accounts, so this should produce a non-zero value. However, the SOM shows $0.

**Root Cause:** The `campaignReadyAccounts` value (1,515) is loaded from the dashboard metrics cache, but the `SimpleTAMCard` component initializes its local `averageDealSize` and `conversionRate` state from props. If the org settings haven't loaded yet when the card first renders (the `useOrgSettings` hook returns defaults asynchronously), the `useEffect` sync may not re-trigger properly, or there could be a race where the component renders with stale values. Most critically though, verifying the actual runtime value of `campaignReadyAccounts` passed to the card is needed -- the source filter logic may be filtering it differently.

After closer inspection: `campaignReadyAccounts` is always passed directly (line 702), not affected by sourceFilter. So the value should be 1,515. The $0 display likely stems from a brief state where data hasn't loaded yet, or the org settings load resetting local state to 0 momentarily. The real fix is to remove the duplicated local state management entirely and rely on the parent's values directly.

### Changes

#### File 1: `src/pages/ExecutiveDashboard.tsx`

Wire up the `onSettingsChange` callback to persist settings:

```typescript
// Import updateSettings from useOrgSettings (already imported on line 64)
const { averageDealSize, conversionRate, updateSettings } = useOrgSettings();

// Pass onSettingsChange to SimpleTAMCard
<SimpleTAMCard
  totalAccounts={...}
  highFitAccounts={...}
  medFitAccounts={...}
  campaignReadyAccounts={campaignReadyAccounts}
  averageDealSize={averageDealSize}
  conversionRate={conversionRate}
  onSettingsChange={({ averageDealSize: ds, conversionRate: cr }) => {
    updateSettings({ average_deal_size: ds, conversion_rate: cr });
  }}
/>
```

This ensures clicking "Apply" writes the new values to the `org_settings` JSON column in the `organizations` table, so they persist across sessions.

#### File 2: `src/components/executive/SimpleTAMCard.tsx`

Simplify state management to prevent stale/zero values:

- Remove the duplicated `useState` for `averageDealSize` and `conversionRate` -- use the prop values directly for calculations
- Keep the `temp` state only for the settings popover (editing in progress)
- This eliminates the race condition where `useEffect` sync from props can produce intermediate $0 values

```typescript
// BEFORE: Duplicated state that can go stale
const [averageDealSize, setAverageDealSize] = useState(initialDealSize);
const [conversionRate, setConversionRate] = useState(initialConversion);

// AFTER: Use props directly for calculations
// Only keep temp state for the popover editing
const averageDealSize = initialDealSize;
const conversionRate = initialConversion;
```

### Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Settings revert after refresh | `onSettingsChange` prop not wired to `updateSettings` | Pass callback from dashboard that calls `useOrgSettings().updateSettings` |
| SOM = $0 | Duplicated local state with async sync can produce stale/zero values | Remove duplicated state; use prop values directly for calculations |

Two files change: `ExecutiveDashboard.tsx` and `SimpleTAMCard.tsx`
