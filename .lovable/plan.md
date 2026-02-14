

# Make ICP Performance Matrix More Visible

## Current State

The components were successfully relocated but may be hard to find:

- **ICP Manager**: The matrix only appears when you click into a specific ICP profile's detail view. On the main ICP list page, it's invisible.
- **Accounts**: PriorityRevenueAccounts is there but may be below the fold.
- **Leads**: Neither component was added here.

Score data exists (11,618 scored accounts for your active ICP), so the matrix will render with data.

## Proposed Changes

### 1. Show the Matrix on the Main ICP Manager Page (not just detail view)
**File**: `src/pages/ICPManager.tsx`
- Add `ICPPerformanceMatrix` to the main ICP list view (the page you see before clicking into a profile), without an `icpId` filter so it shows all scored accounts across all ICPs.
- Keep the filtered version in the detail view as well.

### 2. Keep PriorityRevenueAccounts on Accounts Page (already working)
No change needed -- just confirming it's at line 512 and rendering.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ICPManager.tsx` | Add an unfiltered `<ICPPerformanceMatrix />` to the main list view so it's visible without clicking into a profile |

This way you'll see the matrix as soon as you navigate to the ICP Manager page, plus a filtered version when you drill into a specific profile.
