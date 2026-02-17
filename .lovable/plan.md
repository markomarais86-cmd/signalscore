
# Add "Score All Accounts" Button to Dashboard

## What Changes

Add the existing `BulkScoring` component to the Customer Dashboard page so you can trigger scoring without navigating to `/accounts`.

## Where It Goes

The button will appear as a new card at the bottom of the dashboard, after the "My Tasks" and "My Pipeline" cards. It will be wrapped in an error boundary (same pattern as the Accounts page) so any issues with scoring won't break the rest of the dashboard.

## Technical Details

**File: `src/pages/CustomerDashboard.tsx`**

1. Import `BulkScoring` and `ComponentErrorBoundary`
2. Add a new section after the two-column grid containing:
   ```
   <ComponentErrorBoundary fallbackTitle="Bulk Scoring unavailable">
     <BulkScoring />
   </ComponentErrorBoundary>
   ```

No `onComplete` callback is needed since the dashboard metrics auto-refresh via React Query. This is a single-file change reusing existing components.
