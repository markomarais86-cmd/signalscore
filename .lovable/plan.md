

## Bulk Custom Attribute Editor on Settings > Verticals

Add an inline data-entry table directly on the Settings > Verticals page so you can view and edit custom attribute values for all accounts in bulk -- no need to open individual account drawers.

### What You'll See

Below each category's attribute definitions (e.g., Healthcare), a new **"Edit Data"** toggle/button expands an editable table:

- **Rows** = accounts (name, domain displayed for context)
- **Columns** = each custom attribute in that category (bed_count, facility_type, ehr_system, etc.)
- Cells are **inline-editable** matching field type (number input, text input, dropdown, multi-select chips)
- **Search/filter** bar to find specific accounts by name or domain
- **Pagination** (50 rows per page) since there are ~40K accounts
- **Save** button to batch-update all changed rows at once
- **Dirty tracking** highlights changed cells so you know what will be saved

### User Flow

1. Go to Settings > Verticals
2. Under a category (e.g., Healthcare), click **"Edit Data"**
3. Table expands showing accounts with columns for each attribute
4. Type values directly into cells (e.g., enter 250 for bed_count)
5. Click **Save Changes** to persist all edits

---

## Technical Details

### New Component: `BulkAttributeEditor`

Create `src/components/settings/BulkAttributeEditor.tsx`:

- **Props**: `orgId`, `category`, `definitions` (the attribute defs for this category)
- **Data fetching**: Paginated query to `accounts` table filtered by `org_id`, selecting `id, name, domain, custom_attributes`, with client-side search on name/domain
- **Rendering**: Uses the existing `Table` components from `src/components/ui/table.tsx`
- **Inline editing**: Each cell renders the appropriate input based on `field_type`:
  - `number` -> `<Input type="number" />`
  - `text` -> `<Input type="text" />`
  - `select` -> `<Select>` dropdown with the definition's `options`
  - `multi_select` -> Dropdown with checkboxes
- **State management**: Local `Record<accountId, Record<fieldKey, value>>` tracking changes
- **Batch save**: On save, iterates changed accounts and calls `supabase.from('accounts').update({ custom_attributes: mergedJson }).eq('id', accountId)` for each changed row
- **Pagination**: 50 rows per page with next/prev controls
- **Search**: Debounced text filter using `ilike` on name or domain

### Modify: `CustomAttributeManager.tsx`

- Import `BulkAttributeEditor`
- Add a toggle button ("Edit Data") next to each category's "Fill Missing" button
- When toggled, render `<BulkAttributeEditor>` below the category's attribute definition list
- Pass the category's definitions and org ID

### Files

- **Create**: `src/components/settings/BulkAttributeEditor.tsx`
- **Modify**: `src/components/settings/CustomAttributeManager.tsx` (add toggle + render the new component)

No database changes needed -- this reads/writes to the existing `accounts.custom_attributes` JSONB column.

