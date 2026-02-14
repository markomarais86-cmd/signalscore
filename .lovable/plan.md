

# LaunchPulse List Builder -- Your Own Apollo/ZoomInfo Search

## Overview

Build a prospecting search tool that lets users search the LaunchPulse database (accounts + leads) using filters, just like Apollo or ZoomInfo. Users define criteria, preview matching results, and export/save lists for campaigns.

## What You Already Have

- **~40K accounts** with industry, revenue range, employee count, location, business model, NAICS codes
- **~53K leads** with title, persona (Technical Decision Maker, Business Decision Maker, etc.), level, email, phone, company linkage
- Campaign builder infrastructure, Apollo redemption flow, and export capabilities already built

## How It Works

```
User opens List Builder
    --> Sets filters (industry, revenue, employee size, geography, persona, title keywords)
    --> Clicks "Search"
    --> Sees matching accounts + lead counts
    --> Can drill into leads per account
    --> Selects results and exports to CSV or pushes to Campaign Builder
```

## New Page: `/list-builder`

### Search Panel (Left Side)
Filters grouped into two tabs:

**Company Filters:**
- Industry (multi-select from 25+ industries in your data)
- Revenue Range (normalized buckets: <$1M, $1M-$10M, $10M-$50M, $50M-$100M, $100M-$500M, $500M-$1B, $1B+)
- Employee Count (ranges: 1-50, 51-200, 201-500, 501-1000, 1000-5000, 5000+)
- Location (country, state, city dropdowns)
- Business Model (B2B, B2C, etc.)
- NAICS code search

**People Filters:**
- Title keywords (free text, e.g. "VP Sales", "CTO")
- Persona (Technical Decision Maker, Business Decision Maker, IT Decision Maker, etc.)
- Level (C-Level, VP, Director, Manager, Individual Contributor)
- Has email (yes/no)
- Has phone (yes/no)

### Results Panel (Right Side)
- Shows matched accounts in a table with columns: Company, Industry, Revenue, Employees, Location, Lead Count
- Expandable rows to see leads within each account
- Checkbox selection for bulk actions
- Total count header: "Found 2,340 accounts with 8,120 leads matching your criteria"

### Actions Bar
- "Export to CSV" -- downloads selected or all results
- "Send to Campaign Builder" -- pushes selected accounts/leads into the existing Campaign Builder flow
- "Save as List" -- saves the filter criteria + results as a named list for reuse

## Database Query Strategy

Use a Supabase RPC function `search_list_builder` that:
1. Joins `accounts` with `Leads` on `account_external_id = external_id`
2. Applies all filters server-side with proper indexing
3. Returns paginated results with lead counts per account
4. Handles the revenue range normalization (your data has many inconsistent formats -- the query will bucket them)

## Sidebar Integration

Add "List Builder" to the **Data** section in the sidebar, between Leads and Enrichment:
- Accounts
- Leads
- **List Builder** (new, with a Search icon)
- Enrichment

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/pages/ListBuilder.tsx` | New page with search filters, results table, export/campaign actions |
| `src/components/list-builder/SearchFilters.tsx` | Filter panel component with company + people filter tabs |
| `src/components/list-builder/ResultsTable.tsx` | Results table with expandable account rows showing leads |
| `src/components/list-builder/SavedLists.tsx` | Saved list management (save/load filter presets) |
| `src/hooks/use-list-builder.ts` | Hook for search queries, pagination, and export logic |
| SQL Migration | Create `search_list_builder` RPC function + indexes on filter columns |
| `src/App.tsx` | Add `/list-builder` route |
| `src/components/AppSidebar.tsx` | Add List Builder to Data navigation group |

## Revenue Range Normalization

The current revenue data has 60+ inconsistent formats. The RPC function will normalize them into standard buckets using a CASE statement so filters work reliably regardless of how the data was originally imported.

## Technical Details

- Pagination: 50 accounts per page with infinite scroll
- Search is server-side via RPC for performance (40K accounts)
- Lead counts are aggregated in the same query using `COUNT(*) OVER`
- Export uses client-side CSV generation (already have jspdf/html2canvas in deps)
- Campaign Builder integration reuses existing `CampaignBuilderV2` component
