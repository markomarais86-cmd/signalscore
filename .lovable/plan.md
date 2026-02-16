

# Fix: Smart Insights Actions Not Working

## Problem

When clicking action buttons on Smart Insights (e.g., "Find Contacts", "Score Accounts", "View Accounts"), the app shows "Action not yet available" because the click handler has gaps in its routing logic.

The `handleItemClick` function checks 4 things in order:
1. Is it a risk with navigate/enrich action? (only handles risks)
2. Does the item have a `route`? (most insights don't -- only 4 action types are mapped to routes)
3. Does the action text match workflow keywords? (only matches penetrate/expand/optimize/campaign/audit)
4. Fallback: shows the error toast you're seeing

Most insight actions (like "Find Contacts", "Enrich Data", "Score Accounts") fall through all checks and hit the fallback.

## Solution

### 1. Expand route mapping (UnifiedInsightsPanel.tsx)

Add missing routes to `mapNextActionToRoute` so more action types navigate properly:

| Action | Route |
|--------|-------|
| `enrich_contacts` | `/accounts` |
| `enrich_data` | `/accounts` |
| `build_campaign` | `/accounts` |
| `contact_leads` | `/accounts` |
| `search_accounts` | `/accounts` |

### 2. Expand workflow type detection (UnifiedInsightsPanel.tsx)

Add more keyword patterns to `inferWorkflowType`:

- "find contacts" / "contact" / "leads" -> `build_target_list`
- "enrich" / "fill" / "complete" -> `enrich_data` (new workflow type)
- "score" / "calculate" / "rescore" -> `score_accounts` (new workflow type)

### 3. Add direct action handling for proactive insight params (UnifiedInsightsPanel.tsx)

The proactive insights from the edge function include structured `actions` with `action` and `params` fields (e.g., `{ action: "enrich_contacts", params: { account_ids: [...] } }`). Add a handler that:

- Checks if the source insight has structured actions with params
- Routes `enrich_contacts` to the enrichment modal with pre-selected accounts
- Routes `search_accounts` to `/accounts` with the filter params (e.g., `min_score=80`)
- Routes `enrich_data` / `score_accounts` / `build_campaign` to appropriate pages with query params

### 4. Fallback improvement

Instead of a dead-end toast, the fallback will navigate to `/accounts` as a reasonable default so users always land somewhere useful.

## Technical Details

### File: `src/components/executive/UnifiedInsightsPanel.tsx`

**Change 1** -- `mapNextActionToRoute` (line ~368-377): Add mappings for `enrich_contacts`, `enrich_data`, `build_campaign`, `contact_leads`, `search_accounts` all pointing to `/accounts`.

**Change 2** -- `inferWorkflowType` (line ~474-480): Add regex patterns:
```
/find.*contact|contact|leads/ -> 'build_target_list'
/enrich|fill|complete|missing/ -> 'enrich_data'  
/score|calculate|rescore/ -> 'score_accounts'
```

**Change 3** -- `handleItemClick` (line ~483-530): Before the fallback toast, add a catch-all that:
- Checks if action text contains "enrich" -> opens enrichment modal
- Checks if action text contains "score" -> navigates to `/accounts?action=score`
- Checks if action text contains "contact" or "find" -> navigates to `/accounts?action=find_contacts`
- Otherwise navigates to `/accounts` as a safe default instead of showing error toast

**Change 4** -- Insight mapping (line ~397-418): Preserve the original proactive insight `actions` array in the `source` so structured params are accessible in `handleItemClick`.

No new files or dependencies needed. All changes are in one file.
