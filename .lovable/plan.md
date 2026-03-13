

# LaunchPulse — Full Application Analysis

## What LaunchPulse Is Today

LaunchPulse is a **B2B account intelligence and GTM optimization platform** that helps revenue teams identify, score, enrich, and activate their best-fit accounts. It operates as a "Managed Demand Engine" — LaunchPulse manages the data infrastructure while customers action the output.

### Core Capabilities (Built and Working)

| Module | What It Does |
|--------|-------------|
| **ICP Manager** | Define multi-dimensional Ideal Customer Profiles (industry, geography, size, revenue, tech stack). AI-assisted ICP builder. Closed-won deal analysis to validate ICP against real conversion data. |
| **Accounts** (12.4K+) | Firmographic database with infinite scroll, filtering, score breakdowns, detail drawers, bulk scoring. Data source toggling (CRM vs database). |
| **Leads** (13.4K+) | Contact database with enriched fields (phone, email, LinkedIn), persona classification, suppression tracking, multi-phone display. |
| **Scoring Engine** | Statistical V2.0 algorithm scoring accounts 0-100 across fit dimensions (industry, geography, size, revenue). Score bands (A/B/C). Score history timeline. Propensity model (ML-based). |
| **Enrichment** | 8-stage waterfall: PDL, Clearbit, AI estimation, deep research. Data gaps visualization, accuracy reports, credits tracking, unified enrichment wizard. |
| **Campaign Builder** | 7-step wizard (Setup → Targeting → Sequence → Persona → DataSource → Preview → Export). 4 Fuel Line types (ABM, Technographic, Firmographic, Persona). Suppression integration. Signal-to-campaign routing. |
| **List Builder** | Filter/search accounts with sidebar filters, export to CSV. |
| **Opportunities** | Kanban deal stage board, revenue attribution panel. |
| **AI Agents** | 4 autonomous agents: Lead Qualification, Follow-Up Automation, Meeting Scheduler, Data Enrichment. Realtime health monitoring, proactive suggestions. |
| **Integrations** | Salesforce, HubSpot OAuth. Zapier webhooks. Clay incoming webhooks. API key management. Data mapping. |
| **Analytics** | Pipeline efficiency, capital efficiency (ROI/CAC), trend analysis, segmentation, fuel line performance tracking. |
| **Presentations** | Auto-generated pitch decks/board reports from platform data. |
| **Admin** | Multi-tenant org management, AI-powered customer onboarding, credit management, feature flags per org, audit logs. |
| **Customer Dashboard** | Simplified view for managed customers: leads, tasks, pipeline at a glance. |
| **Signals** | Real-time account signals (intent, tech changes, funding, hiring) with priority levels and dashboard action cards. |

### Architecture Strengths
- Multi-tenant with org isolation (RLS on all tables)
- Parent/child org hierarchy for managed service model
- Feature flags per organization
- Credit-based enrichment with cost tracking
- Dual interface: operator (full platform) vs customer (simplified dashboard)

---

## How LaunchPulse Compares to Google Tag Manager (GTM)

**These are fundamentally different products.** GTM is a tag management system for deploying marketing/analytics scripts on websites. LaunchPulse is a B2B account intelligence platform.

However, if you mean **"Go-To-Market" (GTM) platforms** — the competitive landscape — here is where LaunchPulse sits:

| Competitor | What They Do | LaunchPulse Advantage | LaunchPulse Gap |
|-----------|-------------|----------------------|-----------------|
| **Apollo.io** | Prospecting database, sequences, enrichment | Deeper ICP scoring, managed service model, multi-source enrichment waterfall | Apollo has 275M+ contacts; LaunchPulse relies on external data |
| **ZoomInfo** | Enterprise data provider, intent signals | 10-100x cheaper enrichment via waterfall, AI estimation fills gaps | ZoomInfo has proprietary first-party data at massive scale |
| **6sense / Demandbase** | ABM platforms, intent data, ad orchestration | Simpler pricing, faster time-to-value, managed model | No native ad orchestration, no website visitor identification |
| **Clay** | Enrichment workflows, data waterfall | Native scoring + campaign builder (Clay is data-only) | Clay has 75+ data providers; LaunchPulse has ~6 |
| **HubSpot** | All-in-one CRM + marketing | Purpose-built for account intelligence; HubSpot is generalist | HubSpot owns the CRM relationship; LaunchPulse is a layer on top |
| **Gong / Clari** | Revenue intelligence, call analytics | Different focus — LaunchPulse is pre-pipeline; they are in-pipeline | No conversation intelligence or forecasting |

### LaunchPulse's Unique Position
LaunchPulse is a **"managed demand engine"** — it sits between data providers and CRMs, doing the analytical work that most GTM teams cannot do themselves: ICP validation against closed-won data, multi-source enrichment at low cost, and statistical scoring. The managed service model (operator runs it for the customer) is rare in this space.

---

## How Companies Would Use LaunchPulse

### B2B SaaS Companies (Primary)
1. Connect Salesforce/HubSpot → sync accounts and deals
2. Analyze closed-won deals to validate/build ICP
3. Score entire database against ICP → find A-band accounts
4. Enrich missing firmographics and contacts
5. Build campaigns from high-scoring accounts using Fuel Lines
6. Push campaign lists back to CRM or outreach tools
7. Track which ICP segments convert best over time

### Sales-Led Organizations
- Use List Builder to find targeted prospects matching ICP
- AI agents auto-qualify inbound leads
- Signal detection triggers outbound campaigns (funding round → ABM campaign)
- Pipeline attribution shows which ICP segments drive revenue

### Marketing Teams
- TAM/SAM/SOM calculation based on ICP
- Persona coverage gap analysis
- Campaign deduplication before launch
- Capital efficiency tracking (CAC by segment)

---

## How PE/VC Firms Would Use LaunchPulse

This is where LaunchPulse has **massive untapped potential** but is currently underbuilt:

### Current Capability (Limited)
- "Portfolio View" is listed as an Enterprise pricing feature but **is not actually built**
- Capital efficiency page exists but is generic
- Board report generation via Presentations
- Multi-org admin allows managing multiple portfolio companies

### What PE/VC Firms Actually Need

**1. Portfolio-Level GTM Diagnostics** — A PE firm buys 5-15 companies. They need a single dashboard showing GTM health across all portfolio companies: which ones have validated ICPs, which have data quality problems, which are targeting the wrong segments.

**2. Value Creation Playbook** — PE firms run a 100-day value creation plan post-acquisition. LaunchPulse could be the tool that operationalizes it: Day 1 connect CRM → Day 7 ICP validated → Day 30 TAM sized → Day 60 campaigns running.

**3. Due Diligence Support** — Before acquiring a company, PE firms need to assess: Is their pipeline real? Are they targeting the right market? What is their actual TAM? LaunchPulse has all the data to answer this but no due diligence workflow.

**4. Benchmarking Across Portfolio** — Compare conversion rates, ICP fit distributions, pipeline velocity, and capital efficiency across portfolio companies.

**5. Board Reporting** — Monthly/quarterly board packages showing GTM progress with consistent metrics across portfolio.

---

## What Is Missing / What We Can Do Better

### Critical Gaps

| Gap | Impact | Effort |
|-----|--------|--------|
| **No website visitor identification** | Cannot capture anonymous intent like 6sense/Demandbase | High (need IP-to-company resolution) |
| **No email sequence execution** | Campaigns export to CRM but LaunchPulse cannot send emails | Medium (integrate with Outreach/SalesLoft APIs or build native) |
| **No ad orchestration** | Cannot push audiences to LinkedIn Ads, Google Ads | Medium (API integrations) |
| **Portfolio dashboard not built** | PE/VC use case is pricing-page-only; no actual feature | Medium |
| **No real-time CRM writeback** | Campaign results and scores do not auto-sync back to CRM fields | Medium |
| **No Slack/Teams notifications** | Signals and agent actions stay in-platform only | Low |
| **No mobile experience** | Dashboard is desktop-only; execs check metrics on phones | Medium |

### Product Improvements

| Improvement | Description |
|------------|-------------|
| **Revenue attribution is weak** | Opportunities page exists but attribution logic is basic. Need multi-touch attribution tying campaigns → pipeline → closed revenue. |
| **AI chat is underutilized** | Global AI assistant exists but is not deeply connected to platform actions. Should be able to "build me a campaign for A-band tech companies in DACH." |
| **Onboarding is admin-only** | Customer self-service onboarding does not guide users through ICP setup → scoring → first campaign. |
| **No competitive intelligence** | No tracking of competitor presence in accounts (technographic signals exist but not productized). |
| **Signal detection is passive** | Signals are stored but the routing to campaigns (Phase 3) is the only automation. Need webhook-triggered workflows. |
| **No territory management** | No rep-level territory assignment or quota tracking despite having geography data. |
| **Reporting is template-only** | Report builder exists but cannot create custom dashboards with drag-and-drop widgets. |

### PE/VC Specific Features to Build

| Feature | Description |
|---------|-------------|
| **Portfolio Command Center** | Cross-org dashboard showing GTM health scores for all portfolio companies. Traffic light system (red/amber/green) per company. |
| **100-Day Plan Tracker** | Pre-built value creation milestones with automated progress tracking. |
| **Due Diligence Mode** | Read-only workspace that can ingest a target company's CRM export and produce an ICP/TAM/pipeline quality assessment without full onboarding. |
| **Portfolio Benchmarking** | Compare metrics across portfolio: conversion rates, ICP fit distributions, enrichment coverage, pipeline velocity. |
| **LP/Board Report Generator** | Auto-generate consistent board-ready GTM reports across portfolio in PDF/PPTX format. |

### Technical Debt

- `AccountExclusions` save was a no-op stub (fixed in Phase 2)
- Discovery page is a redirect stub — not a real feature
- Demo mode uses hardcoded mock data (`DEMO_ACCOUNTS`)
- Multiple skeleton/loading components that could be unified
- 63 edge functions — need consolidation audit

