
# LaunchPulse / SignalScore — Master Plan

## Part A: Fuel Line Engine (COMPLETED)

_Original implementation plan — all 5 phases shipped._

### Context
LaunchPulse operates a **Managed Demand Engine** — we run campaigns on behalf of customers.
The "Fuel Line" concept (segmented data pipelines into campaigns) adapts to our managed model where **we** control the infrastructure and customers action the output.

### Completed Phases
1. **Phase 1** — Fuel Line Types in Campaign Builder ✅
2. **Phase 2** — Suppression List Management ✅
3. **Phase 3** — Signal-to-Campaign Routing ✅
4. **Phase 4** — Fuel Line Performance Tracking ✅
5. **Phase 5** — Automated Campaign Triggers ✅

---

## Part B: Full App Audit & Improvement Plan

_Generated: 2026-04-01_

### Legend
- ✅ **Real** — Live Supabase data, working CRUD, deployed edge functions
- ⚠️ **Partial** — Has backend but incomplete features or missing edge functions
- 🔴 **Stub/Static** — Hardcoded UI, no real data, or non-functional
- 🟡 **Needs Improvement** — Works but won't meet customer expectations

---

### PAGE-BY-PAGE AUDIT

#### 🟢 CORE PAGES — Production Ready

| Page | Status | Data Source | Notes |
|------|--------|-------------|-------|
| **Executive Dashboard** (`/dashboard`) | ✅ Real | `useDashboardData` → Supabase RPC + queries | KPIs, ICP coverage, geography, data health. Solid. Source filter working. |
| **ICP Manager** (`/icp-manager`) | ✅ Real | Supabase CRUD + `generate-icp-recommendations` + `bulk-score-accounts` | Full lifecycle: create, edit, score, sync Apollo. Best page in the app. |
| **Accounts** (`/accounts`) | ✅ Real | Supabase queries + predictions hook | Filtering, sorting, enrichment status, ICP scoring. Strong. |
| **Leads/Contacts** (`/leads`) | ✅ Real | Supabase queries + `match_leads_to_accounts_fast` RPC | Lead matching, filtering, data quality indicators. |
| **Data Upload** (`/data-upload`) | ✅ Real | `bulk-upload` edge function, CSV parsing | Multi-step upload wizard, field mapping, chunked processing. |
| **Enrichment** (`/enrichment`) | ✅ Real | `get_enrichment_page_stats` RPC + multiple enrich-* edge functions | Provider selection, cost estimation, waterfall enrichment. |
| **Admin Dashboard** (`/admin`) | ✅ Real | Supabase auth + `get_users_with_emails` RPC | User management, org management, role assignment. |
| **Settings** (`/settings`) | ✅ Real | Supabase CRUD | Multi-tab: profile, org, integrations, API keys, benchmarks. |
| **Auth** (`/auth`) | ✅ Real | Supabase Auth | Login, signup, password reset. |
| **AI Agents** (`/ai-agents`) | ✅ Real | Supabase queries + `run-agent` edge function | Agent CRUD, run history, real execution. |

#### 🟡 FUNCTIONAL BUT NEEDS IMPROVEMENT

| Page | Status | Issue | Customer Impact |
|------|--------|-------|-----------------|
| **Customer Dashboard** (`/my-dashboard`) | ⚠️ Partial | Real data but very sparse — no charts, insights, or ICP visibility | Customers will feel shortchanged |
| **Tasks** (`/tasks`) | ✅ Real | `lead_tasks` table. Basic list — no calendar, team assignments, reminders | Won't compete with CRM task managers |
| **Opportunities** (`/opportunities`) | ✅ Real | `deals` table. Kanban + attribution | No forecasting or win/loss drilldown |
| **Segmentation** (`/segmentation`) | ✅ Real | `segments` table. Create/delete works | JSON config instead of visual filter builder — poor UX |
| **List Builder** (`/list-builder`) | ✅ Real | Supabase queries | Works but disconnected from campaigns |
| **AI Feedback** (`/ai-feedback`) | ✅ Real | `ai_decision_feedback` table | Niche — only useful after AI enrichment |

#### 🟡 EDGE FUNCTION DEPENDENT

| Page | Status | Edge Function | Risk |
|------|--------|---------------|------|
| **Pipeline Efficiency** (`/pipeline-efficiency`) | ⚠️ | `pipeline-metrics` ✅ exists | Works if data populated |
| **Capital Efficiency** (`/capital-efficiency`) | ⚠️ | `capital-metrics` ✅ exists | Niche — most customers won't have investment data |
| **Trends** (`/trends`) | ⚠️ | `trend-metrics` ✅ exists | Requires time-series data accumulation |

#### 🔴 STUBS & NON-FUNCTIONAL

| Page | Status | Issue |
|------|--------|-------|
| **Report Builder** (`/reports`) | 🔴 Stub | Creates configs but generates nothing. No PDF/Excel output. |
| **Presentations** (`/presentations`) | 🔴 Stub | 33 lines. No real data integration. |
| **Customer Upgrade** (`/upgrade`) | 🔴 Static | Static pricing cards, no Stripe. "Upgrade" does nothing. |
| **Help** (`/help`) | 🟡 Static | 643 lines hardcoded FAQ. No search, tickets, or live chat. |

#### 🔵 FEATURE-FLAGGED (PE/VC)

| Page | Flag | Status |
|------|------|--------|
| **Portfolio Command Center** (`/portfolio`) | `portfolio_management` | ⚠️ Partial |
| **Value Creation Plan** (`/value-creation`) | `portfolio_management` | 🔴 Stub |
| **Due Diligence** (`/due-diligence`) | `portfolio_management` | 🔴 Stub |

#### 🟢 MARKETING PAGES — Working

Landing, About, Product, Pricing, Contact, Demo, Legal pages (terms, privacy, DPA, security, subprocessors) — all complete.

---

### WHAT CUSTOMERS WILL LOVE ✅

1. **ICP Manager** — Define ideal customer profile, auto-score, Apollo sync
2. **Executive Dashboard** — Real KPIs, source filtering, data health
3. **Enrichment Engine** — Multi-provider waterfall, cost tracking, 151 edge functions
4. **Data Upload** — CSV upload with intelligent field mapping
5. **AI Agents** — Configurable automation with real execution logs
6. **Account Scoring** — Propensity scores, fit/intent/reachability breakdown

### WHAT CUSTOMERS WON'T LIKE ❌

1. **Customer Dashboard is bare** — Standard users get almost nothing useful
2. **Report Builder is fake** — Creates "configs" but generates nothing
3. **Upgrade page does nothing** — No payment integration
4. **Segmentation UX is poor** — JSON config instead of visual filter builder
5. **No email/notification system** — Alerts exist in DB but no delivery mechanism
6. **Help is a static FAQ** — No search, no tickets, no live chat
7. **Tasks lack depth** — No assignments, no calendar view, no reminders
8. **Presentations is a stub** — Barely functional

### BEST PRACTICES ASSESSMENT

| Area | Status | Gap |
|------|--------|-----|
| Role-based access | ✅ | — |
| Auth security | ✅ | — |
| Code splitting | ✅ | — |
| Error boundaries | ✅ | — |
| Feature flags | ✅ | — |
| Dark mode | ✅ | — |
| Data export | ✅ | — |
| Audit logging | ✅ | — |
| Onboarding wizard | ✅ | — |
| Empty states | ✅ | — |
| SEO | ⚠️ | Marketing pages need meta tags, JSON-LD |
| Analytics/tracking | ⚠️ | `usePageTracking` exists but no GA/Segment |
| Billing/payments | 🔴 | No Stripe, no usage metering |
| Email transactional | 🔴 | Auth emails only, no general notifications |
| Mobile responsive | 🟡 | Complex tables break on mobile |

---

### PHASED IMPROVEMENT PLAN

#### Phase 1: Quick Wins & Credibility (1-2 weeks)
_Remove anything that makes the product look unfinished_

- [ ] Delete or hide Report Builder — replace with "Coming Soon" or remove from nav
- [ ] Delete or hide Presentations stub
- [ ] Fix Customer Upgrade — integrate Stripe or replace with "Contact Sales" CTA
- [ ] Remove Capital Efficiency from default nav — add as feature flag
- [ ] Improve Segmentation UX — visual filter dropdowns instead of JSON
- [ ] Clean up dead files: `Discovery.tsx`, `PipelineAnalyticsPage.tsx`, `QuickEnrich.tsx`

#### Phase 2: Customer Dashboard Overhaul (2-3 weeks)
_Make standard users want to log in_

- [ ] Add KPI cards — ICP fit score, enrichment status, recent activity
- [ ] Add account score distribution chart
- [ ] Add recent signals/alerts feed
- [ ] Add quick actions — "View top accounts", "See overdue tasks", "Export data"
- [ ] Add welcome/getting-started checklist
- [ ] Show ICP qualification breakdown

#### Phase 3: Revenue & Billing (3-4 weeks)
_Enable self-service monetization_

- [ ] Integrate Stripe for subscriptions
- [ ] Add usage metering — enrichment credits, API calls, seats
- [ ] Build proper Upgrade flow — tier selection → checkout → confirmation
- [ ] Add billing history in Settings
- [ ] Implement credit-based enrichment limits

#### Phase 4: Communication & Notifications (2-3 weeks)
_Keep users engaged and informed_

- [ ] Email notifications — enrichment/scoring complete, weekly digest
- [ ] In-app notification center with unread count
- [ ] Slack/webhook alerts — wire up `send-alert` edge function
- [ ] Task due date reminders

#### Phase 5: Advanced Features (4-6 weeks)
_Competitive differentiation_

- [ ] Report Builder v2 — actual PDF/Excel generation with templates
- [ ] Visual Segment Builder — drag-and-drop filter rules
- [ ] Calendar view for Tasks
- [ ] Deal forecasting in Opportunities
- [ ] Win/Loss analysis drilldown
- [ ] Interactive Help Center — search, videos, ticket submission

#### Phase 6: Scale & Polish (Ongoing)
_Enterprise readiness_

- [ ] SSO/SAML authentication
- [ ] Audit log viewer in admin panel
- [ ] API rate limiting dashboard
- [ ] Mobile-responsive table redesign
- [ ] Performance monitoring with Sentry custom transactions
- [ ] i18n framework
- [ ] WCAG 2.1 AA accessibility audit

---

### INFRASTRUCTURE NOTES

- **151 edge functions** deployed
- **xlsx dependency** removed from npm, loaded via CDN
- **PE/VC pages** gated behind `portfolio_management` feature flag
- **Active redirects**: `/quick-enrich` → `/enrichment`, `/api-access` → `/settings?tab=api`, `/pipeline-analytics` → `/pipeline-efficiency`
- **Dead files to clean**: `Discovery.tsx`, `PipelineAnalyticsPage.tsx`, `QuickEnrich.tsx`
