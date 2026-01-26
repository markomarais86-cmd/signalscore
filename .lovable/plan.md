
# Plan: Enhance Agentic AI Architecture

## Overview
This plan upgrades LaunchPulse from a **Level 3 (Orchestrated Multi-Agent)** to a **Level 5 (Autonomous Multi-Agent System)** based on the agentic AI maturity model. The focus is on dynamic agent discovery, real-time coordination, autonomous planning, and enhanced human-in-the-loop capabilities.

---

## Current State Analysis

| Component | Current Implementation | Maturity |
|-----------|----------------------|----------|
| Orchestrator | `ai-orchestrator` with static workflows | Medium |
| Memory | `ai-memory` with preferences/templates | Medium |
| Tools | `ai-actions-router` with 20+ actions | High |
| Feedback | `AIFeedbackQueue` for enrichment review | Medium |
| Multi-Agent | `agent-pipeline-controller` (linear) | Low |
| Planning | Static `parameterMapper` + `skipCondition` | Low |

---

## Phase 1: Agent Registry and Discovery Protocol

**Goal**: Enable agents to dynamically register capabilities and discover other agents at runtime.

### 1.1 Create Agent Registry Table
New database table to store agent capabilities:

```text
+---------------------------+
|     ai_agent_registry     |
+---------------------------+
| id (uuid)                 |
| agent_name (text)         |
| agent_type (text)         |
| capabilities (jsonb[])    |
| input_schema (jsonb)      |
| output_schema (jsonb)     |
| status (enum)             |
| health_score (float)      |
| avg_latency_ms (int)      |
| last_heartbeat (timestamp)|
+---------------------------+
```

### 1.2 Create `agent-registry` Edge Function
- **Actions**: `register`, `deregister`, `heartbeat`, `discover`, `find_capable`
- Agents self-register on startup with their capabilities
- Health monitoring via periodic heartbeats
- Discovery queries: "Find agents that can enrich phone numbers"

### 1.3 Update Existing Agents
Modify `agent-lead-qualification`, `agent-data-enrichment`, etc. to:
- Call `agent-registry.register` on invocation
- Include capability metadata (e.g., `["qualify_leads", "score_icp_fit"]`)
- Send heartbeats during long-running operations

---

## Phase 2: Dynamic Task Delegation Protocol

**Goal**: Enable agents to delegate sub-tasks to other agents based on discovered capabilities.

### 2.1 Create `agent-coordinator` Edge Function
Central coordination layer that:
- Receives task requests with required capabilities
- Queries registry for capable agents
- Routes tasks with load balancing (round-robin or least-busy)
- Handles retries and fallbacks

### 2.2 Task Queue Table

```text
+---------------------------+
|     ai_task_queue         |
+---------------------------+
| id (uuid)                 |
| parent_task_id (uuid)     |
| requesting_agent (text)   |
| required_capabilities[]   |
| assigned_agent (text)     |
| priority (int)            |
| status (enum)             |
| payload (jsonb)           |
| result (jsonb)            |
| created_at (timestamp)    |
| claimed_at (timestamp)    |
| completed_at (timestamp)  |
+---------------------------+
```

### 2.3 Inter-Agent Communication Pattern
```text
Lead Qualification Agent
        |
        v
[Needs phone validation]
        |
        v
agent-coordinator.delegate({
  capability: "validate_phone",
  payload: { phone: "+1..." }
})
        |
        v
[Registry lookup: find_capable("validate_phone")]
        |
        v
Phone Validation Agent
        |
        v
[Result returned to Lead Qualification]
```

---

## Phase 3: Autonomous Planning Layer

**Goal**: AI proactively suggests and initiates workflows based on data state and anomalies.

### 3.1 Create `agent-planner` Edge Function
Autonomous planner that:
- Runs on schedule (every 15 minutes)
- Analyzes current data state (scores, pipeline health, anomalies)
- Generates recommended actions with confidence scores
- Auto-executes high-confidence actions (configurable threshold)

### 3.2 Planning Rules Engine

```text
+---------------------------+
|   ai_planning_rules       |
+---------------------------+
| id (uuid)                 |
| rule_name (text)          |
| trigger_condition (jsonb) |
| action_workflow (text)    |
| parameters_template (jsonb)|
| confidence_threshold (float)|
| auto_execute (boolean)    |
| requires_approval (boolean)|
+---------------------------+
```

Example rules:
- **Low enrichment coverage**: "If accounts with missing phones > 100, trigger data_enrichment"
- **Score drift**: "If avg score drops 10% week-over-week, trigger optimize_icp"
- **Stale leads**: "If qualified leads without follow-up > 7 days, trigger follow_up agent"

### 3.3 Proactive Insights Component
New UI component `ProactiveAgentSuggestions` that:
- Displays AI-recommended actions
- Shows reasoning and confidence
- One-click approval or dismissal
- Learning from user decisions

---

## Phase 4: Real-Time Agent Status Updates

**Goal**: Live visibility into agent execution via WebSocket/Realtime subscriptions.

### 4.1 Enhance `ai_agent_runs` Table
Add real-time columns:
- `progress_percentage` (int)
- `current_step` (text)
- `step_details` (jsonb)
- `live_metrics` (jsonb)

### 4.2 Create `useAgentRealtime` Hook
React hook that:
- Subscribes to `ai_agent_runs` changes via Supabase Realtime
- Provides live progress updates
- Auto-reconnects on connection loss

### 4.3 Enhanced Agent Dashboard
Update `AIAgents.tsx` with:
- Live progress bars during execution
- Step-by-step status updates
- Real-time metrics (records processed, errors)
- Agent health indicators (green/yellow/red)

---

## Phase 5: Enhanced Human-in-the-Loop

**Goal**: Extend feedback beyond enrichment to all agent decisions.

### 5.1 Universal Feedback Table

```text
+---------------------------+
|   ai_decision_feedback    |
+---------------------------+
| id (uuid)                 |
| agent_name (text)         |
| decision_type (text)      |
| entity_type (text)        |
| entity_id (uuid)          |
| ai_recommendation (jsonb) |
| confidence (float)        |
| user_decision (enum)      |
| user_feedback (text)      |
| outcome_tracked (boolean) |
| created_at (timestamp)    |
+---------------------------+
```

### 5.2 Create `UniversalFeedbackQueue` Component
Unified queue that aggregates:
- Enrichment suggestions (existing)
- Lead qualification decisions
- Follow-up recommendations
- Meeting scheduling proposals

### 5.3 Feedback Learning Loop
- Track outcomes of approved/rejected decisions
- Calculate agent accuracy per decision type
- Auto-adjust confidence thresholds based on feedback
- Surface poorly-performing decision categories

---

## Implementation Files

| Phase | New/Modified Files |
|-------|-------------------|
| 1 | `supabase/functions/agent-registry/index.ts` |
| 1 | Migration: `ai_agent_registry` table |
| 2 | `supabase/functions/agent-coordinator/index.ts` |
| 2 | Migration: `ai_task_queue` table |
| 3 | `supabase/functions/agent-planner/index.ts` |
| 3 | Migration: `ai_planning_rules` table |
| 3 | `src/components/agents/ProactiveAgentSuggestions.tsx` |
| 4 | `src/hooks/use-agent-realtime.ts` |
| 4 | Update `src/pages/AIAgents.tsx` |
| 5 | Migration: `ai_decision_feedback` table |
| 5 | `src/components/feedback/UniversalFeedbackQueue.tsx` |

---

## Technical Notes

### Database Migrations Required
1. `ai_agent_registry` - Agent capability store
2. `ai_task_queue` - Inter-agent task delegation
3. `ai_planning_rules` - Autonomous planning configuration
4. `ai_decision_feedback` - Universal feedback tracking
5. Alter `ai_agent_runs` - Add real-time progress columns

### Edge Function Architecture
- All new functions follow existing patterns with CORS headers
- Use service role key for cross-agent invocations
- Implement circuit breaker pattern for agent health
- Target <500 lines per function for deployment stability

### Performance Considerations
- Agent registry queries cached for 60 seconds
- Task queue uses database-level locking for claim operations
- Planner runs with 15-minute intervals to avoid overload
- Realtime subscriptions limited to active workflows only

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agent coordination | Linear (4 stages) | Dynamic (N agents) |
| Task delegation | Manual | Automatic |
| Planning | Reactive | Proactive |
| Feedback coverage | Enrichment only | All decisions |
| Real-time visibility | Polling | WebSocket |

