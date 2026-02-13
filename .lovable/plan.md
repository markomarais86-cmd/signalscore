
# Fix Dashboard Interactivity and Add Export Button

## Problem
The Executive Dashboard has click/interaction issues and the Export Report button is not visible on the main dashboard header.

## Root Causes Identified

### 1. Rules of Hooks Violation (Critical)
In `ExecutiveDashboard.tsx`, the `useStatusItems` function (named with `use` prefix, treated as a hook by React) is called at line 367 -- **after** three early `return` statements (lines 333, 337, 348). React 19 may enforce rules of hooks more strictly, potentially corrupting the component's internal state and breaking event handlers.

### 2. Duplicate Keyboard Listeners (Minor)
Three separate components all register `Cmd+K` handlers:
- `AIChat.tsx` (line 402-413)
- `GlobalCommandPalette.tsx` (already in Layout)
- Executive `CommandPalette.tsx` (also rendered inside ExecutiveDashboard)

This creates redundant event listeners. The executive-level `CommandPalette` should be removed since `GlobalCommandPalette` already provides the same functionality from the Layout.

### 3. Missing Export Button on Dashboard Header
The `ExportToPdf` button is only rendered inside `DrilldownNavigation.tsx`, not on the main dashboard. Users cannot access it from the primary view.

## Changes

### File 1: `src/pages/ExecutiveDashboard.tsx`
- Move `useStatusItems(...)` call **before** the early return guards (before line 333), alongside the other hooks
- Remove the embedded `CommandPalette` component (lines 406-417) since `GlobalCommandPalette` in Layout already handles this
- Remove the `CommandPaletteTrigger` from the dashboard header actions (line 427) since it already exists in the Layout header
- Add the `ExportToPdf` button to the main dashboard header action bar (around line 468), next to the existing Score/Enrich/Health buttons

### File 2: `src/components/executive/CommandPalette.tsx`
- No deletion needed, but the executive-specific `CommandPaletteTrigger` will no longer be rendered on the dashboard. The component can remain for other pages that might use it.

## Technical Details

### Hook ordering fix (ExecutiveDashboard.tsx)
```text
BEFORE (broken):
  Line 63: const { data: filterStats } = useSourceFilterStats(...)
  ...
  Line 333: if (authLoading) return ...     <-- early return
  Line 337: if (!userProfile) return ...     <-- early return  
  Line 348: if (queryError) return ...        <-- early return
  ...
  Line 367: const statusItems = useStatusItems(...)  <-- VIOLATION

AFTER (fixed):
  Line 63: const { data: filterStats } = useSourceFilterStats(...)
  Line 64: const statusItems = useStatusItems(...)   <-- moved up
  ...
  Line 333: if (authLoading) return ...
  Line 337: if (!userProfile) return ...
  Line 348: if (queryError) return ...
```

### Export button addition
The `ExportToPdf` component will be added in the secondary actions group, after the Health toggle button, giving users direct access to the Board PDF Report from the main dashboard view.

## Implementation Order
1. Fix `useStatusItems` hook ordering in `ExecutiveDashboard.tsx`
2. Remove duplicate `CommandPalette` and its trigger from the dashboard
3. Add `ExportToPdf` button to the dashboard header
