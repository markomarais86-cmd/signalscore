

# Phase 2: Routing + SLA Engine and Task Assignment

## Overview

This phase adds two major capabilities to complete the middle of your funnel: automatically routing qualified leads to the right sales rep, enforcing response-time SLAs, and creating actionable tasks tied to those leads.

## What We're Building

### 1. Lead Routing Rules Engine

A rules-based system that automatically assigns incoming leads to sales reps based on configurable criteria:
- **Geography** (country/state)
- **Company size** (employee count ranges)
- **Score threshold** (ICP or qualification score)
- **Industry** match

Rules are evaluated in priority order -- first matching rule wins.

### 2. SLA Timer System

Each routing rule includes an SLA (e.g., "contact within 15 minutes"). If a lead isn't actioned within the SLA window:
- An alert fires via the existing `send-alert` edge function (Slack/email)
- The lead is flagged as "SLA breached" in the dashboard

### 3. Task Assignment

When a lead is routed, tasks are auto-created:
- **Call** the lead (due per SLA)
- **Send intro email** (due per SLA)
- **Schedule demo** (if score is high enough)

Tasks appear in a new "Tasks" view and are linked to leads.

---

## Database Changes

### New Tables

**`lead_routing_rules`**
- `id`, `org_id`, `name`, `priority` (integer, lower = higher priority)
- `conditions` (JSONB -- geography, company_size_min/max, min_score, industries)
- `assigned_to` (user_id from user_profiles)
- `sla_minutes` (integer -- max response time)
- `auto_tasks` (JSONB array -- task templates to create)
- `is_active` (boolean)
- `created_at`, `updated_at`

**`lead_tasks`**
- `id`, `org_id`, `lead_id` (references marketing_leads or accounts)
- `lead_type` (text -- 'marketing_lead' or 'account')
- `assigned_to` (user_id)
- `task_type` (text -- 'call', 'email', 'demo', 'follow_up')
- `title`, `description`
- `due_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text -- 'pending', 'in_progress', 'completed', 'overdue')
- `routing_rule_id` (references lead_routing_rules)
- `created_at`

### New Columns

**`marketing_leads`** -- add:
- `assigned_to` (uuid, nullable -- routed sales rep)
- `routed_at` (timestamptz)
- `routing_rule_id` (uuid, nullable)
- `sla_deadline` (timestamptz)
- `sla_breached` (boolean, default false)

---

## New Edge Function

**`route-lead`** -- called after enrichment/scoring:
1. Fetches active routing rules for the org (ordered by priority)
2. Evaluates lead data against each rule's conditions
3. On match: updates `marketing_leads` with assignment, sets SLA deadline
4. Auto-creates tasks from the rule's `auto_tasks` template
5. Sends a Slack/email alert to the assigned rep via `send-alert`
6. If no rule matches: assigns to a default/round-robin fallback

**`check-sla-breaches`** -- scheduled or called periodically:
1. Finds leads where `sla_deadline < now()` and `sla_breached = false` and no task completed
2. Marks them as breached
3. Fires escalation alerts

---

## New UI Components

### Settings: Routing Rules Tab
- Added as a new tab in the existing Settings page
- Table of routing rules with name, conditions summary, assigned rep, SLA, active toggle
- Add/edit modal with condition builder (dropdowns for geography, sliders for score/size, rep selector)

### Tasks Page (new route: `/tasks`)
- Kanban or list view of tasks grouped by status (Pending / In Progress / Completed / Overdue)
- Filter by assignee, task type, due date
- Click to view linked lead details
- Mark complete button
- Overdue tasks highlighted in red

### Lead Detail Enhancement
- Show routing info (which rule matched, assigned rep, SLA status)
- Show linked tasks inline

---

## Integration Points

- **Trigger**: The `demo-request` edge function (or a new post-scoring webhook) calls `route-lead` after a lead is scored
- **Alerts**: Reuses existing `send-alert` for SLA breach notifications
- **Users**: Pulls sales reps from `user_profiles` table (users with roles in `user_roles`)

---

## Technical Details

### Files to Create
- `supabase/migrations/[timestamp]_routing_sla_tasks.sql` -- tables, RLS policies, indexes
- `supabase/functions/route-lead/index.ts` -- routing logic
- `supabase/functions/check-sla-breaches/index.ts` -- SLA monitoring
- `src/pages/Tasks.tsx` -- task management page
- `src/components/settings/RoutingRulesSettings.tsx` -- routing rules config UI
- `src/components/tasks/TaskBoard.tsx` -- task list/board component
- `src/components/tasks/TaskCard.tsx` -- individual task display
- `src/components/tasks/CreateTaskDialog.tsx` -- manual task creation
- `src/hooks/use-tasks.ts` -- data fetching hook
- `src/hooks/use-routing-rules.ts` -- routing rules CRUD hook

### Files to Modify
- `src/pages/Settings.tsx` -- add "Routing" tab
- `src/App.tsx` -- add `/tasks` route
- `supabase/functions/demo-request/index.ts` -- call `route-lead` after lead creation
- `src/integrations/supabase/types.ts` -- add new table types

### Routing Rule Condition Example
```json
{
  "geography": ["US", "CA"],
  "company_size_min": 50,
  "company_size_max": 500,
  "min_qualification_score": 70,
  "industries": ["SaaS", "Technology"]
}
```

### Auto-Task Template Example
```json
[
  { "type": "call", "title": "Initial outreach call", "due_offset_minutes": 15 },
  { "type": "email", "title": "Send intro email", "due_offset_minutes": 30 },
  { "type": "demo", "title": "Schedule product demo", "due_offset_minutes": 1440 }
]
```

