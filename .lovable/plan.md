
# Add "Create New Organization" Button to Customer Onboarding Page

## What This Does
Adds a quick-create button next to the existing "AI Onboard Customer" button on the customer onboarding list page. It reuses the existing `QuickCreateOrgDialog` component and navigates to the new org's onboarding wizard after creation.

## Changes

### `src/pages/admin/CustomerOnboarding.tsx`

1. **Import** the existing `QuickCreateOrgDialog` component and `Plus` icon from lucide-react
2. **Add state** `quickCreateOpen` to the `CustomerOrgPicker` component
3. **Add a second button** ("+ New Organization") next to the "AI Onboard Customer" button in the header area
4. **Render** `QuickCreateOrgDialog` with an `onSuccess` callback that navigates to `/admin/customer-onboarding/{newOrgId}` and invalidates the `all-orgs` query so the list updates
5. **Wrap** the two buttons in a `flex gap-2` container

### No new files needed
The `QuickCreateOrgDialog` component already exists at `src/components/QuickCreateOrgDialog.tsx` and does exactly what's needed -- a simple dialog with one name input that inserts into the `organizations` table.

## Technical Detail

In the `CustomerOrgPicker` function (~line 214-222), the header section changes from one button to two:

```
[Manage your customers' demand engine setup]

[+ New Organization]  [AI Onboard Customer]
```

The `onSuccess` handler will:
1. Invalidate `all-orgs` query (so the grid refreshes)
2. Navigate to the new org's onboarding wizard via `navigate(/admin/customer-onboarding/${orgId})`
