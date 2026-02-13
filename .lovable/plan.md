
# Fix: Remove `service_type` from `org_onboarding_config` Upsert

## Problem
The Company Profile step in Customer Onboarding includes a `service_type` field in its form. When saving, it upserts **all** form values into the `org_onboarding_config` table, but that table has no `service_type` column -- it lives on the `organizations` table instead. This causes the Supabase schema cache error.

## Solution
Two changes are needed:

### 1. `src/components/admin/OnboardingStepCompany.tsx`
- Remove `service_type` from the local form state and the `onSave(values)` payload
- Instead, save `service_type` directly to the `organizations` table in a separate Supabase update call when the user clicks Save
- The component already receives `orgId` as a prop, so it can do: `supabase.from('organizations').update({ service_type }).eq('id', orgId)`

### 2. `src/pages/admin/CustomerOnboarding.tsx`
- No changes needed -- the `saveConfig` mutation upserts whatever values it receives, and once `service_type` is removed from the payload, the error goes away

## Technical Detail

In `OnboardingStepCompany.tsx`:
- Remove `service_type` from the `values` state object
- Remove the Service Type `Select` from the form UI (or keep it but handle it separately)
- In `handleSave`, split the save: send everything except `service_type` to `onSave()`, and update `organizations.service_type` directly via a separate Supabase call
- Import `supabase` client for the direct update
