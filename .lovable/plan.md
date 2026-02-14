

# Fix: Smart Insights Quick Actions Still Not Working

## Root Cause

The previous fix added `inferWorkflowType` and `handleItemClick` logic, but missed the core data mapping issue. There are **two bugs**:

### Bug 1: Insights have no `action` field

The `ICPInsight` type (from `use-icp-insights.tsx`) has a `nextAction` field (values like `'build_campaign'`, `'enrich_data'`, `'score_accounts'`, `'view_accounts'`). But the `Insight` interface in `UnifiedInsightsPanel` expects an `action` field. When the insights array is passed from `ExecutiveDashboard` to `UnifiedInsightsPanel`, the `nextAction` field is **never mapped to `action`**. Result: `item.action` is always `undefined`, so the action buttons never render at all.

### Bug 2: Risk action is the wrong value

For risks, on line 367: `action: risk.fix?.action` maps to `'enrich'` or `'navigate'` (the fix action type), not a user-visible action label. This means the button text says "enrich" or "navigate" instead of something useful like "Enrich Data" or "Score Accounts".

## Solution

### 1. Map `nextAction` to `action` with human-readable labels

In the `unifiedItems` array construction (line 372-393), map `insight.nextAction` (or the `ICPInsight` equivalent) to a human-readable `action` string and a corresponding `route`:

| `nextAction` value | `action` label | `route` |
|---|---|---|
| `build_campaign` | "Prepare Campaign" | (workflow) |
| `enrich_data` | "Enrich Data" | (inline enrich) |
| `score_accounts` | "Score Accounts" | `/accounts` |
| `view_accounts` | "View Accounts" | `/accounts` |
| `contact_leads` | "Find Contacts" | (workflow) |
| `export_csv` | "Export Data" | `/accounts` |
| `review_accounts` | "Review Accounts" | `/accounts` |

### 2. Fix risk action label

Map `risk.fix?.label` to the card's action text instead of `risk.fix?.action`. The `fix.label` already has good text like "Score Accounts", "Enrich Data", "Standardize Industries".

### 3. Add `Sparkles` import check

The `Sparkles` icon was added to action buttons but needs to be in the import list (verify it's there from the previous edit).

## Files Changed

| File | Change |
|------|--------|
| `src/components/executive/UnifiedInsightsPanel.tsx` | Fix the `unifiedItems` mapping: use `risk.fix?.label` for risk actions; map `insight.nextAction` (via type coercion since ICPInsight is passed as Insight) to readable action strings with corresponding routes |

## Technical Detail

The insight mapping block (lines 372-393) changes from:

```
action: insight.action,
route: insight.route,
```

to:

```
action: mapNextActionToLabel(insight),
route: mapNextActionToRoute(insight),
```

Where `mapNextActionToLabel` converts `nextAction` values to human-readable button text, and `mapNextActionToRoute` provides navigation targets for non-workflow actions.

The risk mapping block (line 367) changes from:

```
action: risk.fix?.action,
```

to:

```
action: risk.fix?.label,
```

This ensures every insight and risk card renders an action button with meaningful text that connects to the right handler.

