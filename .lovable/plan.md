

# Add Visual Indicator for Child Org Data Filtering

## What Changes
When the dashboard is showing data filtered to a child org's scored subset (rather than the full parent dataset), a new info-style status item will appear in the existing StatusBar component. This makes it immediately clear that the numbers represent a filtered view.

## Technical Approach

### 1. Update `buildStatusItems` in `src/components/executive/StatusBar.tsx`
- Add a new parameter `isChildOrg: boolean` and optional `childOrgName: string`
- When `isChildOrg` is true, push a new status item of type `'info'` with:
  - Title: "Showing scored accounts only"
  - Description: "Data filtered to accounts scored by [org name] -- not the full parent dataset"
  - No action button needed (this is informational)

### 2. Update `src/pages/ExecutiveDashboard.tsx`
- The page already imports `useDataOrgId()` which exposes `isChildOrg`
- Pass `isChildOrg` (and the selected org name from `useOrgSwitcher`) into `buildStatusItems`
- No new components needed -- reuses the existing StatusBar

### Result
- Child orgs see a blue info banner: "Showing scored accounts only -- Data filtered to accounts scored by Ninety One Life"
- Parent orgs and standalone orgs see no change
- The indicator appears alongside existing status items (scoring progress, data quality alerts, etc.)
