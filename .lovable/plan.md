

## Problem

The `bed_count` (and other custom attributes like `facility_type`, `ehr_system`, etc.) can be **defined** in Settings > Verticals, but there is no way to **manually edit** them on individual accounts. The Account Detail Drawer only shows standard firmographic fields (domain, industry, employee count, revenue, country) as read-only text -- it has zero awareness of custom attributes.

The "Fill Missing" bulk AI enrichment is the only path to populate these fields, which is not always practical (requires AI credits, may return inaccurate data, or simply may not find the info).

## Solution

Add a **Custom Attributes section** to the Account Detail Drawer's Overview tab that:
1. Fetches the org's `custom_attribute_definitions` to know which fields exist
2. Reads the account's `custom_attributes` JSONB column to show current values
3. Renders inline-editable fields (number input, text input, select dropdown, multi-select) matching each definition's `field_type`
4. Saves changes back to the `accounts.custom_attributes` column on edit

---

## Technical Details

### 1. Update Account interface (`AccountDetailDrawer.tsx`)

Add `custom_attributes` to the `Account` interface so the drawer has access to the JSONB data.

### 2. Fetch custom attribute definitions

Inside `AccountDetailDrawer`, add a query to `custom_attribute_definitions` filtered by `org_id` to get all defined fields (field_key, field_label, field_type, options, category).

### 3. New component: `CustomAttributesEditor`

Create a new component `src/components/accounts/CustomAttributesEditor.tsx`:
- Receives: `accountId`, `customAttributes` (current JSONB), `definitions` (array of field defs)
- Renders each defined attribute as an editable field:
  - **number**: Input with type="number"
  - **text**: Input with type="text"
  - **select**: Select dropdown with the definition's `options`
  - **multi_select**: Checkboxes or multi-select for the definition's `options`
- Shows current value from `custom_attributes[field_key]` or empty/placeholder
- On change, updates `accounts.custom_attributes` via a merged JSONB update
- Groups fields by `category` with section headers

### 4. Add section to Overview tab

Insert the `CustomAttributesEditor` card between the "Company Information" and "Data Quality" cards in the Overview tab, with a header like "Vertical Attributes" and an edit icon.

### 5. Update parent components

Ensure wherever `AccountDetailDrawer` is used, the `account` object includes `custom_attributes` in the select query.

### Files to create/modify
- **Create**: `src/components/accounts/CustomAttributesEditor.tsx`
- **Modify**: `src/components/accounts/AccountDetailDrawer.tsx` (add custom_attributes to interface, fetch definitions, render editor)
- **Modify**: Any parent that queries accounts for the drawer (to include `custom_attributes` in the select)

