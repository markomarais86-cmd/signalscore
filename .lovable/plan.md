
# Priority Revenue Accounts Table (Section 4)

## What It Does

A sortable table showing the top accounts ranked by **readiness score** (composite of fit, intent, reachability, and deal presence). Each row includes auto-generated "next best action" text based on the account's data gaps and pipeline state. Clicking a row navigates to the account detail page.

## Data Sources

Three parallel queries scoped by `effectiveOrgId`:

| Table | Fields Used | Purpose |
|-------|------------|---------|
| `scores` (joined to `accounts`) | fit, intent, reachability, overall, account name, industry, revenue_range, enriched_at, domain | Core scoring + account metadata |
| `deals` | account_external_id, status, stage, amount, expected_close_date | Pipeline context for action generation |
| `Leads` | account_external_id (count) | Contact coverage check |

## Readiness Score Calculation

A composite 0-100 score computed client-side:

```
readiness = (
  (fit ?? 0) * 0.30 +
  (intent ?? 0) * 0.30 +
  (reachability ?? 0) * 0.20 +
  (hasContacts ? 10 : 0) +
  (hasDeal ? 10 : 0)
)
```

This weights ICP fit and intent equally (60% combined), adds reachability (20%), and gives bonus points for having contacts and an active deal.

## Auto-Generated Next Actions

Rule-based logic that examines each account's data state and produces a single actionable recommendation:

| Condition | Next Action |
|-----------|-------------|
| No contacts (lead count = 0) | "Find decision-maker contacts" |
| Has contacts but no deal | "Create outbound sequence" |
| Deal exists, stage = early | "Schedule discovery call" |
| Deal exists, stalled (no update 30+ days) | "Re-engage -- deal stalling" |
| Deal exists, late stage | "Send proposal / negotiate" |
| High fit but low intent | "Nurture with content" |
| Missing enrichment | "Enrich account data" |
| Default | "Review account" |

## Table Columns

| Column | Content |
|--------|---------|
| Account | Name + industry badge |
| Readiness | Score bar (0-100) with color coding |
| Fit / Intent | Two small numbers side by side |
| Contacts | Count from Leads table |
| Deal Stage | Current deal stage or "--" |
| Next Action | Auto-generated action with icon |

## Features

- Sorted by readiness descending (top 25 by default)
- "Show more" button to load next 25
- Color-coded readiness bar: green (>70), amber (40-70), red (<40)
- Row click navigates to `/accounts/{external_id}`
- Loading skeleton while fetching
- Empty state when no scored accounts exist

## Technical Details

### New File
`src/components/executive/PriorityRevenueAccounts.tsx`

### Query Pattern
Follows the same pattern as `ICPPerformanceMatrix`:
- Uses `useEffectiveOrg()` for org scoping
- React Query with `enabled: !!effectiveOrgId`
- Parallel `Promise.all` for scores+deals+lead-counts
- Lead count query: `supabase.from('Leads').select('account_external_id').eq('org_id', effectiveOrgId)` then count per account in JS

### Component Structure
```
Card
  CardHeader (title: "Priority Revenue Accounts", icon: Crown)
  CardContent
    Table (shadcn Table components)
      - Sortable headers
      - Top 25 rows, expandable
    "Show more" button
```

Uses existing shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead` components plus `Badge`, `Progress`, `Button`, and `Skeleton`.

### Props
Self-contained (fetches own data), optional ICP filter:
```typescript
interface PriorityRevenueAccountsProps {
  icpId?: string;
  limit?: number; // default 25
}
```

### Files
| File | Action |
|------|--------|
| `src/components/executive/PriorityRevenueAccounts.tsx` | **Create** -- standalone priority accounts table |

No other files modified. Integration into dashboard happens separately.
