

# Surface Full ICP Profile on the Dashboard

## Problem
The dashboard fetches `icpProfiles` data (line 117 of `ExecutiveDashboard.tsx`) but never renders it. Users can only see ICP scoring results (high/med/low fit counts) but not the actual ICP definition -- the target industries, company sizes, geographies, personas, and other criteria configured in the ICP Manager.

## Solution
Add an **ICP Profile Summary Card** to the dashboard that displays the active/primary ICP profile's targeting criteria, giving users immediate visibility into what their scoring is based on.

## What Gets Added

### 1. New Component: `ICPProfileSummaryCard`
A new card component at `src/components/executive/ICPProfileSummaryCard.tsx` that renders:
- **ICP name and status** (active/draft/archived badge)
- **Target Industries** -- displayed as tags/badges
- **Company Sizes** -- shown as range labels
- **Revenue Ranges** -- displayed inline
- **Geographies** -- listed as region tags
- **Persona Targeting** -- job titles, seniority levels, departments
- **Tech Stack** -- if defined
- **Confidence Score** -- visual indicator
- **"View Full Profile" link** -- navigates to `/icp-manager`
- Graceful handling when no ICP profiles exist (prompt to create one)

### 2. Dashboard Integration
Add the `ICPProfileSummaryCard` to the dashboard layout in `ExecutiveDashboard.tsx`:
- Place it in the 3-column grid alongside the existing SimpleICPTable, SimpleTAMCard, and SimpleGeographyCard
- Uses the already-fetched `icpProfiles` data (no new queries needed)
- Shows the primary/first active ICP profile

### 3. Layout Adjustment
Restructure the grid to accommodate the new card:
- Row 1 (existing): GrowthCommandKPIs + ICPCoveragePanel
- Row 2: **ICPProfileSummaryCard** (full width or 2-col) showing the ICP definition
- Row 3 (existing): SimpleICPTable, SimpleTAMCard, SimpleGeographyCard
- Row 4 (existing): DataHealthWidget + UnifiedInsightsPanel

## Technical Details

### New file: `src/components/executive/ICPProfileSummaryCard.tsx`

```typescript
interface ICPProfileSummaryCardProps {
  icpProfiles: any[];  // Uses the already-fetched icpProfiles from dashboardData
  className?: string;
}
```

The component will:
- Pick the primary ICP (where `is_primary === true`) or fall back to the first active profile
- Display all major targeting dimensions using Badge components for tags
- Show a compact, scannable layout with labeled sections
- Include a "Manage ICPs" button linking to `/icp-manager`
- Show an empty state with a "Create ICP" CTA if no profiles exist

### Modified file: `src/pages/ExecutiveDashboard.tsx`
- Import `ICPProfileSummaryCard`
- Add it to the JSX between `ICPCoveragePanel` and the 3-column grid
- Pass `icpProfiles={icpProfiles}` (already available, just unused)

### No database or migration changes required
The `icpProfiles` data is already being fetched via `useDashboardData` -- it just needs to be rendered.

