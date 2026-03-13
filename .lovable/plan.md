

# Full System Analysis: What's Working, What's Not, and How to Improve

---

## AREA 1: Help Documentation -- NOT STANDARD

**Current State:** The help content in `helpContent.ts` (1,809 lines) is a static hardcoded database with several factual inaccuracies:

| Problem | Detail |
|---|---|
| **Wrong providers listed** | Docs reference Clearbit and ZoomInfo as enrichment providers. The actual waterfall is: Cache -> Perplexity -> Firecrawl -> Multi-AI (Claude/Gemini/Grok) -> PDL -> Apollo -> Hunter. Clearbit and ZoomInfo are never used anywhere in the codebase. |
| **Wrong pricing** | Lists "Clearbit: $0.05, ZoomInfo: $0.10, Apollo: $0.08" -- none of this is real. |
| **Wrong enrichment order** | States "1. Clearbit 2. ZoomInfo 3. Apollo 4. PDL" -- completely wrong. |
| **Broken video links** | All 6 video tutorials point to `https://launchpulse.com/tutorials/*` which are placeholder URLs that don't resolve. |
| **Outdated feature descriptions** | No mention of AI Agents, Smart Enrichment waterfall, Intent Signals, Campaign Builder, List Builder, or PowerUp. These are core features. |
| **Missing categories** | No documentation for: AI Chat (Cmd+K), Report Builder, Value Creation Plan, Portfolio Command Center, Discovery, Segmentation. |

**Fix Plan:**
1. Rewrite `helpContent.ts` to reflect the actual enrichment waterfall (Perplexity -> Firecrawl -> Multi-AI -> PDL -> Apollo)
2. Remove all Clearbit/ZoomInfo references
3. Remove or replace broken video tutorial URLs (hide the Videos tab until real content exists)
4. Add documentation for the 8+ undocumented features (AI Agents, Intent Signals, List Builder, Campaign Builder, etc.)
5. Update pricing section to reflect the actual credit-based model from the `organizations` table

---

## AREA 2: Enrichment -- PARTIALLY WORKING

**Current State:** The enrichment pipeline (`enrich-unified` + `provider-waterfall.ts` at 2,634 lines) is architecturally solid but has operational issues:

| Component | Status | Issue |
|---|---|---|
| **Provider waterfall** | Working | 6-stage pipeline with cache, early-exit, accuracy validators |
| **Credit system** | Working | Checks `enrichment_credits_used` vs `enrichment_credits_total` |
| **Job tracking** | Working | `enrichment_jobs` table with progress, but last job processed only 6/100 records |
| **Actual enrichment rate** | Poor | Network logs show the latest job: 100 total, 6 processed, **0 enriched**, 0 failed. The waterfall runs but returns nothing useful. |
| **Timeout** | Likely culprit | `MAX_EXECUTION_TIME_MS = 55000` (55s). With concurrency=3 and complex AI calls per record, the function times out before completing the batch. |
| **QuickEnrich modal** | UI works | But calls `enrich-unified` which hits the same timeout/yield problem |

**Root Causes:**
- The waterfall calls Perplexity, Firecrawl, then up to 3 AI providers *sequentially per record*. At ~3-5s per provider call, a single record can take 15-25s. With concurrency=3, only 6-9 records finish before the 55s timeout.
- The job completes with `processed: 6, enriched: 0` suggesting the waterfall found no new data (possibly already cached or fields already populated, so it exits early with 0 new fields).

**Fix Plan:**
1. **Increase effective throughput**: Skip cache-miss records that already have >80% field coverage (many records may already be enriched from prior runs)
2. **Add a "fields actually missing" pre-check** in the edge function: before calling the waterfall, check which fields are null. If a record has all 5 core fields (industry, size, revenue, geo, domain), skip it entirely.
3. **Surface enrichment results better**: The UI shows "0 enriched" even when fields were confirmed (cache hit = already good). Change the reporting to distinguish "already complete" vs "newly enriched" vs "failed to enrich."
4. **Add a progress indicator** that shows why records were skipped (already enriched, no domain, timeout).

---

## AREA 3: Intent Signals / Smart Insights -- NOT GREAT

**Current State:** Two separate systems generate "intelligence":

### 3A. `compute-intent-signals` (Intent Signals)
- Computes 4 signal types: engagement_velocity, multi_thread, score_change, coverage_gap
- **Problem**: Network logs show `account_signals` returns **empty array** (`[]`). No signals are being generated.
- **Root cause**: Engagement velocity requires `activities` table data (empty) and falls back to `score_history`. But score_history needs >= 3 changes per account in 7 days to trigger, which is unlikely unless bulk rescoring happened recently. Multi-threading needs leads linked to accounts via `account_external_id` -- the edge function logs show `leadCoveragePercent: "0.0"` and `accountsWithLeads: 0`, meaning leads aren't linked to accounts.
- **Critical finding**: 1,000 leads exist but `accountsWithLeads: 0`. This means the `account_external_id` column on the Leads table is not populated. Without this join key, no lead-to-account signals can be computed.

### 3B. `generate-icp-insights` (AI Insights)
- Uses Gemini 2.5 Flash via Lovable AI gateway with tool calling
- **Working well**: Generates 11-13 insights per run, filters hallucinations, uses real data metrics
- **Problem areas**:
  - Generates a "0% Lead Coverage" insight because leads aren't linked to accounts (same root cause as above)
  - Filters it out via post-validation, but the underlying data problem remains
  - Insights are generic ("Target $100M-$500M segment") rather than specific to the user's actual wins
  - No closed-won deal data available (`deals?.length || 0` likely returns 0), so revenue-based insights are calculated with `avgDealValue = NaN` or 0

**Fix Plan:**

1. **Fix the lead-account linkage** (highest impact): Create/improve a matching function that links Leads to accounts by domain or company name. Run `match-leads-to-accounts` edge function. This single fix would:
   - Enable all multi-threading signals
   - Fix lead coverage stats (currently showing 0%)
   - Make insights about contact gaps accurate instead of filtered out

2. **Improve intent signal computation**:
   - Lower the engagement velocity threshold from 3 changes/week to 1 (more realistic for weekly scoring cadence)
   - Add a new signal type: `data_freshness` -- flag high-fit accounts whose enrichment data is >90 days old
   - Add a new signal type: `new_high_fit` -- accounts that just crossed the 70-score threshold

3. **Improve AI insights quality**:
   - Feed closed-won deal patterns into the prompt (if `closed_won_deals` table has data)
   - Add win-rate by industry/segment to make insights more specific
   - Include ICP criteria in the prompt so insights reference actual ICP definitions
   - Add a "momentum" signal: compare current week's score distribution to last week's

---

## AREA 4: What IS Working Well

| Component | Assessment |
|---|---|
| **ICP Scoring engine** | Solid. Server-side via `score-accounts` edge function, reads pre-computed scores. |
| **Provider waterfall architecture** | Excellent design. Cache, early-exit, accuracy validators, circuit breakers. |
| **Dashboard UI** | Rich. Growth KPIs, donut charts, geography, data health, status bar. |
| **Org resolution** | Now correct with `useDataOrgId()` for data queries vs `effectiveOrgId` for scores. |
| **Type safety** | Improved with `callCustomRpc<T>()` and typed realtime payloads. |
| **AI Chat** | Functional. Queries accounts, signals, supports natural language. |
| **ICP Insights generation** | Good AI prompt engineering with tool calling, post-validation filters. |
| **List Builder** | Now has score filtering with fit bands. |
| **Campaign Builder** | Working with correct org resolution. |

---

## Implementation Priority

| # | Task | Impact | Effort |
|---|---|---|---|
| 1 | **Fix lead-account linkage** (run match-leads-to-accounts or create matching logic) | Critical -- unblocks intent signals, lead coverage, multi-threading insights | Medium |
| 2 | **Rewrite help documentation** to match actual features and providers | High -- user-facing credibility | Medium |
| 3 | **Improve enrichment reporting** (distinguish "already complete" vs "newly enriched" vs "failed") | High -- user confusion about "0 enriched" | Low |
| 4 | **Add new intent signal types** (new_high_fit, data_freshness) and lower velocity thresholds | Medium -- more useful signals | Low |
| 5 | **Feed ICP criteria + closed-won data into insights prompt** for more specific recommendations | Medium -- better insights quality | Low |
| 6 | **Remove broken video links** from help (hide Videos tab) | Low -- cosmetic but hurts trust | Trivial |

