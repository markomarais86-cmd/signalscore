

## Add "Missing Value" Filter to Bulk Attribute Editor

Add a dropdown filter to the toolbar that lets you filter accounts to only those missing a value for a specific attribute (e.g. `bed_count`). This makes it easy to find accounts that still need data entry or enrichment.

### What changes

**File: `src/components/settings/BulkAttributeEditor.tsx`**

1. **New state**: Add a `missingField` state (`string | null`) to track which attribute field to filter by
2. **Toolbar**: Add a `Select` dropdown between the search input and account count, with options:
   - "All accounts" (default / no filter)
   - One option per attribute definition: "Missing {field_label}" (e.g. "Missing Bed Count")
3. **Query logic**: When `missingField` is set, add a Supabase `.or()` filter that matches accounts where `custom_attributes` is null OR the specific key is missing/null. This uses the JSONB arrow operator: `custom_attributes->>{field_key}.is.null,custom_attributes.is.null`
4. **Reset page**: Changing the filter resets to page 0 (same pattern as search)

### Technical Details

- The filter uses Supabase's PostgREST JSONB filtering: `.or(\`custom_attributes.is.null,custom_attributes->>${missingField}.is.null\`)`
- The `missingField` value is added to the `fetchAccounts` dependency array alongside `debouncedSearch`
- The Select component uses `"__all__"` as the value for "no filter" since Radix Select doesn't support empty string values
- No new dependencies needed -- reuses existing `Select` component already imported

