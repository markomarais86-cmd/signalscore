

## Compliance and Security Hardening -- Implementation Plan

This plan covers the code changes needed to publish your legal/compliance pages and upgrade the existing Privacy Policy and Terms of Service with GDPR-required content.

---

### Part 1: Upgrade Privacy Policy

**File: `src/pages/PrivacyPolicy.tsx`**

Add the following new sections after existing content:
- **Data Controller Identity** -- LaunchPulse company name, address, contact email, and data protection contact
- **Legal Basis for Processing** -- Legitimate interest, contract performance, consent (GDPR Article 6)
- **International Data Transfers** -- Supabase/AWS US hosting, Standard Contractual Clauses (SCCs)
- **Automated Decision-Making** -- Disclosure that AI is used for ICP scoring; right to request human review
- **Subprocessors** -- Link to the new `/subprocessors` page listing all third-party services

---

### Part 2: Upgrade Terms of Service

**File: `src/pages/TermsOfService.tsx`**

Add four new sections:
- **Data Processing** -- Reference to the DPA at `/dpa`; confirms LaunchPulse acts as data processor
- **Indemnification** -- Mutual indemnification clause
- **Service Level** -- Uptime target or explicit disclaimer of SLA
- **Governing Law and Jurisdiction** -- England and Wales (matching UK ICO registration)

---

### Part 3: New Page -- Data Processing Agreement (`/dpa`)

**New file: `src/pages/DataProcessingAgreement.tsx`**

Same layout as Privacy/Terms (GradientBackground, MarketingNav, MarketingFooter). Sections:
- Definitions (controller, processor, data subject, personal data)
- Scope and purpose of processing
- Processor obligations (security measures, confidentiality, assistance)
- Sub-processing (with link to `/subprocessors`)
- Data breach notification (72-hour commitment per GDPR Article 33)
- Data deletion/return on termination
- Audit rights
- Liability and indemnification

---

### Part 4: New Page -- Security Overview (`/security`)

**New file: `src/pages/Security.tsx`**

Sections:
- Infrastructure (Supabase on AWS, encryption at rest AES-256, TLS 1.2+ in transit)
- Authentication and access controls (RLS, org-level isolation, MFA roadmap)
- Data isolation (multi-tenant with org_id scoping)
- Incident response process
- Compliance (Supabase SOC 2 Type II)
- Responsible disclosure / security contact email

---

### Part 5: New Page -- Subprocessors (`/subprocessors`)

**New file: `src/pages/Subprocessors.tsx`**

A styled table listing:
| Subprocessor | Purpose | Location |
|---|---|---|
| Supabase | Database, auth, storage | USA |
| OpenAI | AI scoring and insights | USA |
| Resend | Transactional email | USA |
| Sentry | Error monitoring | USA |
| Google Analytics | Website analytics | USA |

---

### Part 6: Update Footer and Routing

**File: `src/components/marketing/MarketingFooter.tsx`**
- Add links for: DPA, Security, Subprocessors (alongside existing Privacy Policy and Terms)

**File: `src/App.tsx`**
- Add three new public routes: `/dpa`, `/security`, `/subprocessors`
- Import the three new page components

---

### Technical Details

**New files (3):**
- `src/pages/DataProcessingAgreement.tsx`
- `src/pages/Security.tsx`
- `src/pages/Subprocessors.tsx`

**Modified files (4):**
- `src/pages/PrivacyPolicy.tsx` -- add 5 GDPR sections
- `src/pages/TermsOfService.tsx` -- add 4 sections
- `src/components/marketing/MarketingFooter.tsx` -- add 3 footer links
- `src/App.tsx` -- add 3 routes + 3 imports

No database changes required. No edge function changes.

