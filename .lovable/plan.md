

# Blueprint Gap Analysis: What's Still Missing

After comparing every stage in your Production-grade LaunchPulse Demand Engine Blueprint against the current codebase, here's what's built, what's partial, and what's completely missing.

---

## Fully Built (no action needed)

| Blueprint Stage | Status |
|---|---|
| Landing page + Quiz funnel (BNT-style) | Done -- `QuizFunnel.tsx` with budget/need/timeline/CRM/size |
| Contact capture | Done -- `marketing_leads` table, `demo-request` edge function |
| Email validation | Done -- `verify-contact` edge function |
| Enrichment orchestrator | Done -- `enrich-unified` + PDL, firmographics, tech stack, funding |
| Scoring service | Done -- `score-account`, weighted model, ICP scoring |
| Routing + SLA engine | Done -- `route-lead`, `check-sla-breaches`, `lead_routing_rules`, `lead_tasks` |
| CRM Lead/Contact + tasks | Done -- task creation, `/tasks` page, routing rules settings |
| Slack/Email alerts | Done -- `send-alert` with Slack webhooks + email |
| Consent + tracking | Done -- `check-consent`, `consent_registry`, cookie consent |
| Dashboards | Done -- executive dashboard, pipeline analytics |
| UTM capture | Done -- `useUTMParams` hook, stored on `marketing_leads` |

---

## Gaps to Fill (7 items from the blueprint)

### 1. Tier-Based Routing (P1/P2/P3) -- NOT BUILT

The blueprint specifies tiered SLAs based on score bands:

| Tier | Definition | SLA | Channels |
|---|---|---|---|
| P1 | Score >= 80 + OTP passed | 5 minutes | Call + Email + LinkedIn |
| P2 | Score 60-79 or missing OTP | 2 hours | Email + LinkedIn |
| P3 | Score < 60 | 24 hours | Nurture only |

**Currently**: Routing uses flat rules with manual SLA settings. No automatic tier assignment from score, no tier-differentiated response channels.

**What to build**: Add `lp_tier` (P1/P2/P3) column to `marketing_leads`, auto-compute tier from `qualification_score` + `otp_status` after scoring, and use tier to select SLA and outreach channels in the routing engine.

### 2. OTP Phone Verification (User-Facing Flow) -- NOT BUILT

The blueprint requires OTP verification before P1 routing. Backend functions exist (`verify-phones`, `verify-carrier`) but there's no user-facing OTP flow.

**What to build**:
- Add phone + OTP input step to the QuizFunnel after contact capture (Screen D in the blueprint)
- New edge function `send-otp` that calls Twilio Verify
- New edge function `verify-otp` that checks the code
- Store `otp_status` (passed/failed/skipped) on `marketing_leads`
- Only assign P1 tier if OTP passed

### 3. Server-Side Conversion Events -- NOT BUILT

The blueprint requires pushing conversion events back to ad platforms (server-to-server):
- GA4 Measurement Protocol (`generate_lead`, `meeting_booked` events)
- Meta Conversions API (CAPI) for offline/server events
- LinkedIn Conversions API

**Currently**: Only client-side pixel tracking exists (`TrackingPixels.tsx`). No server-side event push.

**What to build**:
- New edge function `push-conversion-event` that fires to GA4 MP, Meta CAPI, and LinkedIn CAPI when key events occur (lead submit, OTP pass, meeting booked, opportunity created)
- Triggered from `demo-request` and `route-lead` after key milestones
- Requires storing Measurement ID / API Secret, Meta Access Token, LinkedIn token in org settings

### 4. Click ID Capture (gclid, fbclid, li_fat_id) -- NOT BUILT

The blueprint specifies capturing platform click IDs for conversion attribution. UTM params are captured but click IDs are not.

**What to build**:
- Extend `useUTMParams` to also capture `gclid`, `fbclid`, `li_fat_id` from URL
- Add `click_ids` JSONB column to `marketing_leads`
- Pass click IDs to server-side conversion events for accurate attribution

### 5. Funnel Variant Tracking -- NOT BUILT

The blueprint maps creative variants to funnel variants (e.g., `hook_2_angle_B`) for A/B testing which ad creative + landing page combination converts best.

**What to build**:
- Add `funnel_variant` column to `marketing_leads`
- Capture from URL param (e.g., `?variant=hook_2_angle_B`) alongside UTMs
- Report on conversion rates by funnel variant in dashboards

### 6. Calendly / Meeting Booking Webhook -- NOT BUILT

The blueprint includes a Calendly webhook that fires `meeting_booked` events, creates CRM meeting objects, and pushes server-side conversion events. `agent-meeting-scheduler` exists but has no Calendly integration.

**What to build**:
- New edge function `calendly-webhook` to receive Calendly `invitee.created` events
- Match meeting to lead by email
- Update lead record with `meeting_booked_at`
- Create a task of type "meeting" in `lead_tasks`
- Fire server-side conversion event (`meeting_booked`) to ad platforms

### 7. Monitoring/Alerting Rules -- PARTIAL

The blueprint specifies specific monitoring thresholds:
- Webhook failure rate > 1% over 15 min
- Enrichment failure rate > 10% daily
- CRM write latency > 2 min p95
- Lead volume drops > 50% vs 7-day baseline
- OTP pass rate < 70%

**Currently**: `check-alerts` exists with some threshold monitoring, but these specific operational metrics aren't tracked.

**What to build**:
- Add funnel-specific health metrics to the existing monitoring system
- Track webhook success/failure rates, enrichment completion rates, OTP pass rates
- New dashboard section: "Funnel Health" showing these operational metrics

---

## Implementation Plan

### Step 1: Tier System + Click IDs + Funnel Variants (Schema + Quick Wins)
- Add columns: `lp_tier`, `otp_status`, `click_ids`, `funnel_variant`, `meeting_booked_at` to `marketing_leads`
- Extend `useUTMParams` to capture click IDs and funnel variant
- Add tier computation logic to `route-lead` (auto-set P1/P2/P3 based on score)
- Update routing UI to show tier badges

### Step 2: OTP Phone Verification Flow
- Add phone input to QuizFunnel (Screen D from blueprint)
- Create `send-otp` edge function (Twilio Verify integration)
- Create `verify-otp` edge function
- Wire OTP status into tier assignment (P1 requires OTP passed)

### Step 3: Server-Side Conversion Events
- Create `push-conversion-event` edge function
- Support GA4 Measurement Protocol, Meta CAPI, LinkedIn CAPI
- Add API credential fields to Settings (Measurement ID, Meta token, etc.)
- Trigger from key pipeline milestones

### Step 4: Calendly Webhook Integration
- Create `calendly-webhook` edge function
- Match meetings to leads, update records
- Fire `meeting_booked` conversion event

### Step 5: Funnel Health Monitoring
- Track operational metrics (webhook rates, enrichment rates, OTP rates)
- Add "Funnel Health" section to dashboard
- Wire into existing `check-alerts` threshold system

---

## Technical Details

### New Database Columns (migration)
```sql
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS lp_tier text; -- P1, P2, P3
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS otp_status text DEFAULT 'pending'; -- pending, passed, failed, skipped
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS click_ids jsonb DEFAULT '{}'; -- {gclid, fbclid, li_fat_id}
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS funnel_variant text; -- hook_2_angle_B
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS meeting_booked_at timestamptz;
```

### New Edge Functions
- `send-otp` -- Twilio Verify: send OTP to phone
- `verify-otp` -- Twilio Verify: check OTP code
- `push-conversion-event` -- Fire server-side events to GA4/Meta/LinkedIn
- `calendly-webhook` -- Receive Calendly meeting events

### Modified Files
- `src/hooks/useUTMParams.ts` -- Add click ID + variant capture
- `src/components/marketing/QuizFunnel.tsx` -- Add phone + OTP step (Screen D)
- `supabase/functions/route-lead/index.ts` -- Add tier computation (P1/P2/P3)
- `src/components/settings/RoutingRulesSettings.tsx` -- Show tier badges
- `src/pages/Settings.tsx` -- Add "Ad Platform API Keys" section
- `supabase/functions/demo-request/index.ts` -- Pass click IDs + variant

### New Files
- `src/components/marketing/OTPVerification.tsx` -- Phone + OTP UI
- `src/components/settings/AdPlatformAPISettings.tsx` -- GA4/Meta/LinkedIn credentials
- `src/components/dashboard/FunnelHealth.tsx` -- Operational metrics panel

