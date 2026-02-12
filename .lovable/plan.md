

## Marketing Lead Capture System

### Overview
Build a complete lead capture pipeline: a `marketing_leads` database table to store all inbound interest, a newsletter signup widget for the landing page and footer, persist demo requests to the database (not just email), and an admin tab to view/export/manage all captured leads.

---

### Part 1: Database -- `marketing_leads` table

Create a new Supabase migration with:

```text
Table: marketing_leads
- id            UUID (PK, default gen_random_uuid())
- email         TEXT NOT NULL
- name          TEXT
- company       TEXT
- subject       TEXT
- message       TEXT
- source        TEXT NOT NULL (e.g. 'newsletter-landing', 'newsletter-footer', 'demo-contact', 'demo-pricing-professional')
- status        TEXT DEFAULT 'new' (values: new, contacted, converted, unsubscribed)
- ip_address    TEXT
- user_agent    TEXT
- created_at    TIMESTAMPTZ DEFAULT now()
- updated_at    TIMESTAMPTZ DEFAULT now()
```

RLS policy:
- Enable RLS on the table
- **INSERT**: Allow anonymous inserts (so unauthenticated visitors can submit)
- **SELECT/UPDATE/DELETE**: Restrict to platform admins only (using existing `is_platform_admin()` function)

Add a unique partial index on `(email, source)` to prevent duplicate signups from the same source, while allowing the same email across different sources.

---

### Part 2: Save demo requests to database

**File: `supabase/functions/demo-request/index.ts`**

After sending emails, insert the lead into `marketing_leads` using the service-role Supabase client:
- Import `createClient` from `@supabase/supabase-js`
- Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars
- Insert: email, name, company, subject, message, source
- This runs server-side so it bypasses RLS correctly
- If the insert fails, log the error but still return success (email was already sent)

---

### Part 3: Newsletter signup widget

**New file: `src/components/marketing/NewsletterSignup.tsx`**

A compact email capture component with:
- Single email input + submit button (inline layout)
- Heading: "Stay in the loop" or "Get GTM insights"
- Submits directly to Supabase `marketing_leads` table via the anon client (allowed by the INSERT RLS policy)
- Source field set based on placement (e.g. `newsletter-landing`, `newsletter-footer`)
- Success state with confirmation message
- Duplicate email handling (graceful -- show success even if already subscribed)
- Privacy policy link

**Update: `src/components/marketing/index.ts`**
- Export the new `NewsletterSignup` component

---

### Part 4: Add widget to Landing page and Footer

**File: `src/pages/Landing.tsx`**
- Add `NewsletterSignup` component between the Features section and the CTA section
- Wrapped in a subtle section with dark glass styling to match the page

**File: `src/components/marketing/MarketingFooter.tsx`**
- Add a compact version of `NewsletterSignup` above the copyright/links row
- Source set to `newsletter-footer`

---

### Part 5: Admin leads view

**File: `src/pages/AdminDashboard.tsx`**

Add a new "Marketing Leads" tab to the existing admin dashboard:
- Table showing: email, name, company, source, status, created_at
- Search/filter by email, source, or status
- Status dropdown to update lead status (new / contacted / converted / unsubscribed)
- Export to CSV button
- Lead count summary cards (total, new this week, by source)

---

### Technical Details

**Files to create:**
- `src/components/marketing/NewsletterSignup.tsx` -- the signup widget
- Supabase migration for `marketing_leads` table

**Files to modify:**
- `supabase/functions/demo-request/index.ts` -- add database insert after email send
- `src/components/marketing/index.ts` -- export new component
- `src/pages/Landing.tsx` -- add newsletter section
- `src/components/marketing/MarketingFooter.tsx` -- add footer signup
- `src/pages/AdminDashboard.tsx` -- add Marketing Leads tab

**No new routes needed** -- the admin view lives inside the existing `/admin` page as a new tab.

**Edge function redeployment required** for the demo-request changes.

