

# Round 2: Admin Health, Global AI, Signal Feed, Auto-Enrichment, Board Report

## Overview

Five high-impact improvements across all focus areas: Admin, AI, Data Pipeline, and Dashboard. Each builds on existing components and edge functions -- no new backend work required.

---

## 1. Live System Health on Admin Dashboard

**What**: Add a "System Health" tab to `/admin` that reuses the existing `SystemHealthDashboard` component (already built for the executive dashboard) and adds a platform-wide view calling the `health-check` edge function.

**Changes**:
- `AdminDashboard.tsx`: Add a new "System Health" tab trigger alongside existing tabs. Import `SystemHealthDashboard` and render it inside the tab content. Add a call to the `health-check` edge function to show database latency, auth status, and active enrichment jobs across all orgs.
- `PlatformMetrics.tsx`: Add two new metric cards -- "Active Enrichment Jobs" (sum across orgs from `enrichment_jobs` where status = processing) and "Edge Function Health" (result from `health-check` edge function).

---

## 2. Global AI Assistant (Cmd+J)

**What**: A floating AI chat dialog accessible from any page via `Cmd+J`. Uses the existing `ai-chat` edge function with context-aware system prompts based on the current route.

**Changes**:
- New file `src/components/GlobalAIAssistant.tsx`: A `CommandDialog`-style floating panel (using Radix Dialog) that opens on `Cmd+J`. Contains a text input, sends messages to `ai-chat` edge function, renders responses with `react-markdown`. Includes route-aware context (e.g., on `/accounts` it adds "The user is viewing their accounts list" to the system prompt). Maintains conversation history in component state (no persistence needed).
- `Layout.tsx`: Import and render `GlobalAIAssistant` alongside the existing `GlobalCommandPalette`.
- `GlobalCommandPalette.tsx`: Add a command item "Ask AI..." that opens the AI assistant.

---

## 3. Real-time Signal Feed on Dashboard

**What**: Add the existing `SignalFeed` component to the executive dashboard. It already reads from `account_signals` and has filtering, dismiss, and detect capabilities -- it just needs to be wired into the dashboard layout.

**Changes**:
- `ExecutiveDashboard.tsx`: Import `SignalFeed` and add it to the dashboard grid, in the Data Health row (replace the current 1/3 + 2/3 split with a 1/3 + 1/3 + 1/3 layout, or place it above the insights panel). Only render when `account_signals` has data (the component already handles empty state gracefully).

---

## 4. Auto-Enrich New Uploads

**What**: After a CSV upload or Apollo sync completes, automatically queue newly imported accounts for enrichment. Leverages existing `enrich-unified` edge function.

**Changes**:
- `ExecutiveDashboard.tsx`: In the `onAccountsChanged` listener and `handleSyncApollo` success handler, add a check: query `accounts` where `enriched_at IS NULL` and `created_at > now() - 5 minutes`, limited to 50. If results exist, invoke `enrich-unified` with `record_type: 'account'` and those account IDs. Show toast: "Auto-enriching X new accounts..."
- `src/pages/DataUpload.tsx` (or equivalent upload success handler): Add similar auto-enrichment trigger after successful upload.

---

## 5. One-Click Board Report PDF

**What**: Wire the existing `generate-board-report` edge function (already called by `use-branded-report.ts`) to a visible "Generate Board Report" button on the dashboard.

**Changes**:
- `ExecutiveDashboard.tsx`: Add a `FileText` icon button in the header actions area (next to Export PDF). On click, invoke `useBrandedReport` hook's generate function. Show loading state and download the resulting PDF. The hook and edge function already exist -- this just surfaces them in the UI.
- Import `useBrandedReport` from existing hook.

---

## Technical Summary

| Item | New Files | Modified Files |
|------|-----------|----------------|
| Admin Health Tab | -- | `AdminDashboard.tsx`, `PlatformMetrics.tsx` |
| Global AI (Cmd+J) | `src/components/GlobalAIAssistant.tsx` | `Layout.tsx`, `GlobalCommandPalette.tsx` |
| Signal Feed on Dashboard | -- | `ExecutiveDashboard.tsx` |
| Auto-Enrich Uploads | -- | `ExecutiveDashboard.tsx`, `DataUpload.tsx` |
| Board Report Button | -- | `ExecutiveDashboard.tsx` |

### Dependencies
- Items 1-5 are independent and can be implemented in parallel
- No new edge functions needed -- all use existing deployed functions
- No database migrations required

