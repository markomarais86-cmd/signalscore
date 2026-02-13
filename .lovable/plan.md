

# Add "Create New Organization" to the Org Switcher Dropdown

## What This Does
Adds a quick-create option directly inside the org switcher dropdown in the header, so you can create a new client organization from anywhere in the app without navigating to Customer Onboarding.

## Changes

### 1. Create a lightweight "Quick Create Org" dialog
A simpler version of `CreateOrganizationDialog` that only requires an organization name (no admin email/invitation flow). This is for the consulting use case where you just need to set up an org to start working in it.

- New component: `src/components/QuickCreateOrgDialog.tsx`
- Single input: organization name
- On success: inserts into `organizations` table, refreshes the org list, and auto-selects the new org

### 2. Update `OrgSwitcherContext` to expose a `refreshOrgs` function
Currently the org list is only fetched once on mount. We need a `refreshOrgs` callback so the dropdown updates after creating a new org without requiring a page reload.

### 3. Update `OrgSwitcher.tsx`
- Replace Radix `Select` with a `Popover` + custom list (since `Select` doesn't support non-selectable items like buttons)
- Add a separator and a "+ New Organization" button at the bottom of the dropdown
- Clicking it opens the `QuickCreateOrgDialog`
- On success, the new org appears in the list and is auto-selected

## Technical Details

### `OrgSwitcherContext.tsx` changes
- Extract `fetchOrgs` into a stable callback
- Expose `refreshOrgs` in the context type and provider value

### `OrgSwitcher.tsx` changes
- Switch from `Select` to `Popover` + `Command` (cmdk) for the dropdown, matching the existing project dependency
- Add `Plus` icon import from lucide-react
- Add state for `quickCreateOpen` dialog
- Render `QuickCreateOrgDialog` with an `onSuccess` that calls `refreshOrgs()` and `setSelectedOrgId(newOrgId)`

### `QuickCreateOrgDialog.tsx` (new file)
- Simple dialog with one text input for org name
- Inserts into `organizations` table via Supabase client
- Returns the new org ID on success so the switcher can auto-select it
- Shows toast confirmation

### Flow
1. Admin clicks org switcher dropdown
2. Sees list of orgs + "+ New Organization" at the bottom
3. Clicks "+ New Organization" -- small dialog appears
4. Types "Ninety One Life" and clicks Create
5. Org is created, list refreshes, new org is auto-selected
6. Admin is now in that org's context immediately

