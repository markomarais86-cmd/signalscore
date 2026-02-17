

# Fix: Vertical Setup Not Working for Child Orgs (91.Life)

## Root Cause

Custom attribute definitions (verticals like "facility_type", "bed_count", "ehr_system", etc.) are all stored under **Launchpulse** (the parent org). When you switch to 91.Life, the ICP wizard and Settings page query `custom_attribute_definitions` filtered by `effectiveOrgId` (91.Life) -- which returns **zero results**. That is why the vertical section appears empty and you cannot set up verticals.

This is the same shared-data pattern as accounts and leads: custom attribute definitions belong to the parent org and should be shared with child orgs.

## What Changes

### 1. `src/components/icp/ICPWizardStep2.tsx`
- Import `useDataOrgId` instead of `useEffectiveOrg`
- Change the `custom_attribute_definitions` query to use `dataOrgId` (resolves to Launchpulse) instead of `effectiveOrgId`
- This makes the vertical filters (facility type, bed count, EHR system, etc.) show up when editing 91.Life's ICP

### 2. `src/components/settings/CustomAttributeManager.tsx`
- Import `useDataOrgId`
- Change the load query to use `dataOrgId` so verticals from the parent org are visible
- Keep insert/update/delete operations using `effectiveOrgId` OR `dataOrgId` depending on policy (if child orgs should be able to add their own custom attributes, use `effectiveOrgId`; if all definitions are managed at the parent level, use `dataOrgId`)
- Recommended: read from `dataOrgId`, write to `dataOrgId` -- custom attribute definitions are a shared resource managed at the parent level

### 3. `src/components/list-builder/SearchFilters.tsx`
- Import `useDataOrgId`
- Change the `custom_attribute_definitions` query to use `dataOrgId` so the "Vertical" filter tab in List Builder shows the correct fields

### 4. `src/components/data-upload/FieldMappingDialog.tsx`
- Update to use `dataOrgId` for loading custom attribute definitions during field mapping

## Summary of Changes

| File | Current | Fix |
|------|---------|-----|
| ICPWizardStep2.tsx | `effectiveOrgId` | `dataOrgId` for custom attr query |
| CustomAttributeManager.tsx | `effectiveOrgId` | `dataOrgId` for read + write |
| SearchFilters.tsx | `effectiveOrgId` | `dataOrgId` for custom attr query |
| FieldMappingDialog.tsx | `orgId` (effective) | `dataOrgId` for custom attr query |

No database migrations needed -- the `useDataOrgId` hook and `parent_org_id` column already exist from the previous round.

