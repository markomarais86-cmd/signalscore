

# Fix: Smart Insights & Actions -- Broken Quick Actions and UI Polish

## Problems Identified

### Problem 1: Quick Action Buttons Do Nothing
When clicking insight action buttons (e.g., "Penetrate under-developed industries"), the `handleItemClick` function (line 444) only handles two cases:
- If the item has a `route` property, it navigates there
- If the item is a risk with `action === 'enrich'`, it opens the enrichment modal

**Most insights have neither.** They have an `action` string like "Penetrate under-developed industries" but no `route` or `filter` to navigate to. Clicking them does nothing -- no navigation, no workflow trigger, no feedback.

### Problem 2: Not Truly Agentic
The whiteboard diagram shows what agentic AI looks like: an **orchestrator with memory, tools, planning, and feedback**. Currently:
- The `ai-orchestrator` edge function exists and has proper multi-step workflows (build_target_list, audit_data_quality, prepare_campaign, optimize_icp)
- The `ProactiveAgentSuggestions` component can approve/execute workflows
- **But the Smart Insights panel never connects to the orchestrator.** Clicking an action should trigger the relevant workflow, but instead it tries to navigate to a URL that doesn't exist.

### Problem 3: Visual Quality
The insight cards are functional but lack visual polish for a premium product.

## Solution

### 1. Wire Quick Actions to the AI Orchestrator

Map each insight/risk action to an actual orchestrator workflow or concrete navigation:

| Action Type | Maps To |
|-------------|---------|
| "Enrich Data" / "Re-enrich" | Trigger `enrich_ai_free` inline (already works) |
| "Penetrate industries" / "Expand coverage" | Start `build_target_list` workflow via ai-orchestrator |
| "Score Accounts" | Navigate to `/accounts?action=score` |
| "Standardize Industries" | Navigate to `/settings?tab=data-quality` |
| "Optimize ICP" | Start `optimize_icp` workflow |
| "Prepare Campaign" | Start `prepare_campaign` workflow |
| Generic insight actions | Use `ai-orchestrator` with inferred workflow type, showing a confirmation dialog first |

When a workflow is triggered, show real-time progress using the existing `AgentRunProgress` component or a toast with progress updates.

### 2. Add Confirmation Dialog for Agentic Actions

Before triggering an orchestrator workflow from an insight click, show a dialog:
- Workflow name and description
- What steps will execute
- "Run Now" button to confirm

This makes it feel intentional and agentic (human-in-the-loop), matching the whiteboard's concept.

### 3. Visual Polish for Insight Cards

- Better card hierarchy with subtle gradients
- Icon colors that match severity consistently
- Animated action buttons on hover
- Progress indicators when a workflow is running from a card
- Better empty states

### 4. Fix Risk Fix Actions

The `RiskItem.fix` already has structured data (`action: 'enrich' | 'navigate'`, `target`, `fields`), but `handleItemClick` doesn't properly use the `fix` property. Update it to:
- For `fix.action === 'navigate'`: navigate to `fix.target`
- For `fix.action === 'enrich'`: open enrichment modal with `fix.fields`

## Files Changed

| File | Change |
|------|--------|
| `src/components/executive/UnifiedInsightsPanel.tsx` | Rewrite `handleItemClick` to map actions to orchestrator workflows or navigation; add workflow confirmation dialog; add workflow progress state; improve card styling |
| `src/utils/risk-detector.ts` | Ensure all `fix` objects have proper `action` and `target` fields |
| `src/components/executive/WorkflowConfirmDialog.tsx` | **New** -- confirmation dialog before executing agentic workflows |

## Technical Details

### Updated `handleItemClick` Logic

```text
handleItemClick(item):
  1. If item is a risk with fix.action === 'navigate' -> navigate(fix.target)
  2. If item is a risk with fix.action === 'enrich' -> open enrichment modal with fix.fields
  3. If item has a route -> navigate(route + filter params)
  4. If item.action contains keywords mapping to known workflows:
     - "enrich" -> trigger inline enrichment (already works)
     - "penetrate" / "expand" / "target" -> open WorkflowConfirmDialog for build_target_list
     - "optimize" / "refine" / "improve ICP" -> open WorkflowConfirmDialog for optimize_icp
     - "campaign" / "outreach" -> open WorkflowConfirmDialog for prepare_campaign
     - "audit" / "quality" -> open WorkflowConfirmDialog for audit_data_quality
  5. Fallback: show toast "Action not yet available"
```

### WorkflowConfirmDialog

A small dialog component that:
- Shows the workflow name and description
- Lists the steps that will execute
- Has "Cancel" and "Run Workflow" buttons
- On confirm: calls `supabase.functions.invoke('ai-orchestrator', { body: { action: 'start_workflow', workflow_type, ... } })`
- Shows a toast with progress and links to the AI Agents page to monitor

### Card Visual Improvements

- Add `backdrop-blur-sm` for glass effect on cards
- Use consistent icon background colors per severity/category
- Add `transition-all duration-200` with `hover:translate-y-[-2px]` for lift effect
- Show a small spinner on the action button when a workflow is running for that item
- Add "AI-powered" badge on actions that trigger orchestrator workflows

