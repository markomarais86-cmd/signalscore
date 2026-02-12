

# Flow Diagram vs. What's Built -- Gap Analysis

## Your Flow Diagram (from the image)

```text
Ad platforms --> Landing page + Quiz funnel --> Contact capture
                                                  |
                                    +-------------+-------------+
                                    |             |             |
                            Qualification    OTP phone      Email
                              answers         verify      validation
                                    |             |             |
                                    +------+------+
                                           |
                                  Enrichment orchestrator
                                           |
                                     Scoring service
                                           |
                                  Routing + SLA engine
                                           |
                          +----------------+----------------+
                          |                |                |
                  CRM: Lead/Contact   Slack/Email      Consent +
                     + tasks            alerts          tracking
                          |
                  Outreach + meetings
                          |
                   Outcomes: opp/closed
                          |
                  Dashboards + model tuning
```

---

## Status of Each Stage

| # | Stage | Status | What Exists |
|---|-------|--------|-------------|
| 1 | **Ad platforms** | NOT BUILT | No ad platform integrations (Google Ads, Meta, LinkedIn, etc.) |
| 2 | **Landing page + Quiz funnel** | PARTIAL | Landing page exists. Demo request form exists. **No quiz funnel** for lead qualification. |
| 3 | **Contact capture** | DONE | DemoRequestForm captures to `marketing_leads` table via `demo-request` edge function. Newsletter signup works. |
| 4 | **Qualification answers** | NOT BUILT | No quiz/questionnaire flow that captures qualification data from the visitor (budget, timeline, company size, etc.) |
| 5 | **OTP phone verify** | PARTIAL | `verify-phones` and `verify-carrier` edge functions exist for backend phone verification. OTP input component exists (`input-otp`). **No user-facing OTP flow** wired together. |
| 6 | **Email validation** | DONE | `verify-contact` edge function validates email format and updates lead records. |
| 7 | **Enrichment orchestrator** | DONE | `enrich-unified` plus multiple enrichment functions (PDL, firmographics, tech stack, funding, contacts, etc.) |
| 8 | **Scoring service** | DONE | `score-account`, `bulk-score-accounts`, `agent-validation-scoring` all exist. ICP scoring, propensity scoring in place. |
| 9 | **Routing + SLA engine** | NOT BUILT | No lead routing rules or SLA timer system. |
| 10 | **CRM: Lead/Contact + tasks** | PARTIAL | Leads and Accounts tables exist. CRM sync functions exist (Salesforce, HubSpot). **No task assignment system.** |
| 11 | **Slack/Email alerts** | DONE | `send-alert` edge function supports Slack webhooks and email notifications. `check-alerts` monitors thresholds. |
| 12 | **Outreach + meetings** | PARTIAL | `agent-follow-up` and `agent-meeting-scheduler` exist. `generate-email-draft` exists. No calendar integration or sequence execution. |
| 13 | **Outcomes: opp/closed** | PARTIAL | Pipeline stages exist in the analytics. No formal opportunity tracking or closed-won/lost workflow. |
| 14 | **Consent + tracking** | DONE | `check-consent` edge function, `consent_registry` table, suppression lists, page tracking hook. |
| 15 | **Dashboards + model tuning** | DONE | Executive dashboard, pipeline analytics, AI feedback system, propensity model training. |

---

## What Needs to Be Built (Priority Order)

### Phase 1: Complete the Inbound Funnel (biggest gaps)

**1. Quiz Funnel on Landing Page**
- Add a multi-step qualification quiz to the landing/demo page
- Capture: company size, industry, current tools, budget range, timeline
- Store answers in a new `quiz_responses` table linked to `marketing_leads`
- Auto-score leads based on qualification answers before they even enter the CRM

**2. Ad Platform Tracking (UTM + Pixel Integration)**
- Add UTM parameter capture on all marketing pages (already have `usePageTracking`)
- Store `utm_source`, `utm_medium`, `utm_campaign` on `marketing_leads`
- Add pixel/snippet support for Meta, Google, LinkedIn in the HTML head
- Social account linking: add your Meta Pixel ID, Google Ads conversion ID, LinkedIn Insight Tag via Settings

**3. OTP Phone Verification Flow**
- Wire the existing `input-otp` component to a user-facing verification step
- After contact capture, prompt for phone + send OTP via Twilio or similar
- Verify before passing to enrichment

### Phase 2: Routing + Automation

**4. Routing + SLA Engine**
- Create routing rules (by geography, company size, score threshold)
- SLA timers: alert if a qualified lead isn't contacted within X minutes
- Auto-assign to sales reps based on rules

**5. Task Assignment System**
- When leads are routed, auto-create tasks (call, email, demo) in the CRM view
- Task due dates tied to SLA rules

### Phase 3: Outcomes + Optimization

**6. Opportunity Tracking**
- Formal opportunity/deal stages (qualified -> demo -> proposal -> closed-won/lost)
- Win/loss reason capture
- Revenue attribution back to ad platform + quiz answers

---

## Social Account Integration

For linking your social accounts (Meta, Google Ads, LinkedIn), the approach would be:

1. **Settings page section** -- "Ad Platform Connections" where you paste:
   - Meta/Facebook Pixel ID
   - Google Ads Conversion ID + label
   - LinkedIn Insight Tag Partner ID
   - TikTok Pixel ID (if needed)

2. These get injected as tracking scripts on the marketing pages automatically

3. For deeper integrations (pulling ad spend data, syncing audiences), each platform requires OAuth -- that would be a later phase using the existing `oauth-initiate`/`oauth-callback` functions

---

## Recommended Next Step

Start with **Phase 1: Quiz Funnel + UTM Tracking + Social Pixels** since that completes the top of your funnel (Ad platforms -> Landing -> Contact capture -> Qualification) and lets you measure ROI from day one.

### Technical Implementation

- New table: `quiz_responses` (id, marketing_lead_id, org_id, answers JSONB, qualification_score, created_at)
- New columns on `marketing_leads`: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `qualification_score`
- New Settings section: Ad Platform IDs stored in org settings
- New component: `QuizFunnel.tsx` -- multi-step form with 4-5 qualification questions
- Modified: `Landing.tsx` or `Demo.tsx` to embed the quiz flow
- Modified: `DemoRequestForm.tsx` to capture UTM params from URL
- New component: `TrackingPixels.tsx` -- renders Meta/Google/LinkedIn pixels based on org settings

