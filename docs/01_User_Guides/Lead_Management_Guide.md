# Lead Management Guide

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse Product Team

## Overview

The Leads page (also called "Contacts") is where you manage individual contacts within your target accounts. This guide covers lead viewing, persona matching, contact discovery, enrichment, and campaign building at the contact level.

## Accessing the Leads Page

**Navigation:** Click **Leads** in the left sidebar

**Default View:** Shows all contacts in your database, organized by account

**Key Metrics (Top of Page):**
- **Total Contacts**: All leads in your database
- **Campaign Ready**: Contacts matching personas with verified emails
- **Avg Reachability**: Average contact reachability score
- **Enriched Contacts**: % of contacts with complete data

## Lead Table Columns

### Standard Columns

| Column | Description | Use Case |
|--------|-------------|----------|
| **Name** | Full name (First + Last) | Primary identifier |
| **Account** | Parent company name | Account association |
| **Title** | Job title | Persona matching |
| **Seniority** | Level (C-Level, VP, Director, Manager, IC) | Decision-maker identification |
| **Department** | Functional area (Sales, Marketing, Engineering) | Persona targeting |
| **Email** | Primary email address | Outreach |
| **Phone** | Direct phone number | Calling campaigns |
| **Reachability** | Contact reachability score (0-100) | Prioritization |
| **Persona Match** | Fit with target persona (0-100) | Campaign filtering |
| **Account Score** | Parent account ICP fit score | Indirect prioritization |

### Reachability Score Components

**How It's Calculated:**
```
Reachability Score = Weighted Average of:
  - Email availability (40%)
  - Email deliverability (30%)
  - Phone availability (20%)
  - LinkedIn profile presence (10%)
```

**Score Interpretation:**
| Score | Badge | Meaning |
|-------|-------|---------|
| 80-100 | 🟢 High | Email + phone + LinkedIn verified |
| 60-79 | 🟡 Medium | Email verified, phone or LinkedIn present |
| 40-59 | 🟠 Low | Email only, unverified |
| 0-39 | 🔴 Very Low | Missing contact info |

### Persona Match Score

**How It's Calculated:**
```
Persona Match Score = Weighted match against ICP persona criteria:
  - Job title match (40%)
  - Seniority level match (30%)
  - Department match (20%)
  - Decision role match (10%)
```

**Example:**
```
Target Persona: VP Sales, Sales Department, C-Level/VP

Contact: "John Doe, VP of Sales, Sales"
  → Title match: 100% (exact match)
  → Seniority match: 100% (VP)
  → Department match: 100% (Sales)
  → Decision role match: 100% (VP is decision-maker)
  = Persona Match Score: 100%

Contact: "Jane Smith, Account Executive, Sales"
  → Title match: 60% (sales role but not VP)
  → Seniority match: 40% (IC, not VP)
  → Department match: 100% (Sales)
  → Decision role match: 20% (IC, not decision-maker)
  = Persona Match Score: 55%
```

## Filtering Leads

### Quick Filters (Top Bar)

**Persona Match Filter:**
```
[All Personas ▼] [High (80+)] [Medium (60-79)] [Low (< 60)]
```

**Reachability Filter:**
```
[All Reachability ▼] [High (80+)] [Medium (60-79)] [Low (< 60)]
```

**Account Score Band Filter:**
```
[All Bands ▼] [A] [B] [C] [D]
```
Filter by parent account's ICP fit score.

**Seniority Filter:**
```
[All Levels ▼] [C-Level] [VP] [Director] [Manager] [IC]
```

**Department Filter:**
```
[All Departments ▼] [Sales] [Marketing] [Engineering] [Product] [Customer Success] [Operations] [Finance] [HR]
```

### Advanced Filters (Click "More Filters")

**Job Title:**
```
Contains: [VP Sales] [Director] [+ Add keyword]
```

**Location:**
```
☐ North America
☐ EMEA
☐ APAC
☐ LatAM
```

**Verified Contact Info:**
```
☐ Has verified email
☐ Has phone number
☐ Has LinkedIn profile
```

**Consent Status (GDPR Compliance):**
```
☐ Consent given
☐ No explicit opt-out
☐ Exclude opted-out contacts
```

**Enrichment Status:**
```
☐ Never enriched
☐ Recently enriched (< 30 days)
☐ Needs re-enrichment (> 90 days)
```

## Lead Detail Drawer

**Opening:** Click any lead row to open detail drawer

### Overview Tab

**Contact Information:**
- Full Name
- Job Title, Seniority Level, Department
- Email (with verification status ✓)
- Phone (with verification status ✓)
- Mobile
- LinkedIn URL

**Account Association:**
- Parent account name (clickable)
- Account ICP fit score
- Account employee count, industry, location

**Persona Match Breakdown:**
```
Overall Persona Match: 87%

Title Match: 95%
  Target: VP Sales, Director Sales
  Actual: VP of Sales ✓

Seniority Match: 100%
  Target: VP, C-Level
  Actual: VP ✓

Department Match: 100%
  Target: Sales, Revenue Operations
  Actual: Sales ✓

Decision Role: 80%
  Likely decision-maker: Yes
  Budget authority: Probable
```

**Reachability Breakdown:**
```
Overall Reachability: 82%

Email: 95% (Verified ✓, Deliverable ✓)
Phone: 80% (Present, not verified)
LinkedIn: 90% (Active profile, recent activity)
```

**Quick Actions:**
- **Enrich Contact**: Deep enrichment (work history, education, social)
- **Verify Email/Phone**: Run verification check
- **View on LinkedIn**: Open LinkedIn profile
- **Add to Campaign**: Add to campaign builder
- **View in CRM**: Open in Salesforce/HubSpot

### Activity Tab

**Contact Activity Timeline:**
```
Nov 26, 2025 10:30 AM - Email opened (Campaign: Q4 Outreach)
Nov 25, 2025 3:15 PM - LinkedIn profile viewed
Nov 24, 2025 9:00 AM - Added to campaign
Nov 23, 2025 2:00 PM - Enriched (PDL + LinkedIn)
Nov 20, 2025 11:00 AM - Created (Salesforce sync)
```

**Engagement Metrics:**
- Email open rate (last 90 days)
- Email click rate
- Response rate
- Meeting booked (Y/N)

### Work History Tab

**Professional Background:**
```
Current: VP of Sales @ Acme Corp (2022 - Present)
  - Responsibilities: Leading 15-person sales team...
  - Achievements: Grew ARR from $5M to $15M...

Previous:
  Director of Sales @ TechCo (2019 - 2022)
  Sales Manager @ StartupXYZ (2016 - 2019)
  Account Executive @ Enterprise Inc (2014 - 2016)
```

**Education:**
- University, Degree, Graduation Year

**Skills & Certifications:**
- List of relevant skills from LinkedIn
- Certifications (e.g., Salesforce Admin, AWS Certified)

### Insights Tab

**AI-Generated Contact Insights:**
```
💡 Recommended Approach:
This contact has been in their current role for 3 years (average tenure for VP Sales). They have a strong background in scaling SaaS sales teams and likely have budget authority for sales enablement tools.

📊 Similar Contacts Converted at 28% (vs 12% average)

💬 Messaging Recommendations:
- Lead with ROI and scalability
- Reference their previous company (TechCo) if you have case studies
- Mention integration with Salesforce (tech stack detected)

⏰ Best Time to Reach:
- Tuesdays and Thursdays, 10 AM - 12 PM PT
- High LinkedIn activity on weekday mornings

🤝 Warm Intro Opportunity:
You have 2 mutual connections on LinkedIn (see LinkedIn tab for details)
```

## Contact Discovery (AI-Powered)

### Discover Contacts for Account

**From Account Detail Drawer:**
```
Accounts page → Select account → Contacts tab → "Discover Contacts" button
```

**Or from Leads Page:**
```
Leads page → Actions ▼ → Discover Contacts for Selected Accounts
```

**Discovery Process:**
```
1. Select target accounts (already have A/B score)
2. Define persona criteria:
   - Job titles: [VP Sales, Director Sales, CRO]
   - Seniority levels: [VP, C-Level]
   - Departments: [Sales, Revenue Operations]
   - Company size filter: 50+ employees

3. AI searches:
   - People Data Labs (PDL)
   - LinkedIn Sales Navigator
   - Company website scraping
   - Social media profiles

4. Results:
   - 127 contacts found across 42 accounts
   - Average 3 contacts per account
   - Average persona match: 84%
   - Estimated enrichment cost: $63.50

5. Review & Approve:
   - Preview contacts before adding
   - Select specific contacts to import
   - Bulk import all contacts

6. Enrichment:
   - Auto-enriches new contacts
   - Verifies emails
   - Calculates reachability scores
```

**Cost:** Contact discovery costs vary by provider:
- **PDL**: $0.50 per contact found
- **ZoomInfo**: $1.00 per contact found
- **Apollo**: $0.30 per contact found

### Backfill Contacts for Existing Accounts

**Use Case:** You have accounts but no associated contacts

**Process:**
```
Settings → Data Quality → Contact Discovery → "Backfill Missing Contacts"

Select accounts:
  - Score bands: A, B (prioritize high-fit)
  - Missing contacts: > 0
  - Total: 247 accounts

Define persona:
  (Same as above)

Run discovery:
  - Estimated contacts found: 741
  - Estimated cost: $370.50

Approval:
  - Review sample of 20 contacts
  - Approve or adjust criteria
  - Run bulk discovery
```

**Best Practices:**
- Start with A band accounts (highest ROI)
- Run discovery in batches (50-100 accounts)
- Monitor budget in Enrichment Analytics

## Lead Enrichment

### Smart Contact Enrichment

**Automatic Enrichment:**
When new leads are added (via CRM sync, manual upload, or discovery), LaunchPulse automatically enriches:
1. **Phase 1 (Immediate)**: Validate email deliverability
2. **Phase 2 (Within 1 hour)**: PDL lookup (job title, seniority, department)
3. **Phase 3 (Within 24 hours)**: LinkedIn profile data
4. **Phase 4 (On-demand)**: Deep enrichment (work history, education, skills)

### Manual Enrichment

**From Lead Detail Drawer:**
```
Select lead → Overview tab → "Enrich Contact" button

Choose enrichment level:
  ○ Basic ($0.50): Email verification + job title
  ○ Standard ($1.50): + LinkedIn profile + work history
  ○ Deep ($3.00): + education + skills + social profiles

Estimated time: 30-60 seconds
```

**Bulk Enrichment:**
```
Select leads → Actions ▼ → Enrich Selected Contacts

Options:
  - Smart Enrich (recommended): Only missing fields
  - Full Enrich: All fields regardless
  - Verify Emails Only: $0.10 per contact

Total cost: $1,245.50 for 415 contacts
```

### Email Verification

**Why Verify?**
- Reduce bounce rate (< 2%)
- Improve sender reputation
- Higher deliverability

**How to Verify:**
```
Select leads → Actions ▼ → Verify Emails

Process:
  1. SMTP validation
  2. MX record check
  3. Disposable email detection
  4. Role-based email detection (e.g., info@, sales@)

Results:
  ✓ Deliverable: 387 (93%)
  ⚠ Risky: 18 (4%)
  ✗ Invalid: 10 (2%)
```

**Cost:** $0.10 per email verification

## Campaign Building from Leads

### Building a Contact-Level Campaign

**Step 1: Filter Contacts**
```
Leads page → Apply filters:
  - Account Score Band: A, B
  - Persona Match: 80+
  - Reachability: 70+
  - Has verified email: ✓
  - Consent: No opt-out

Result: 1,247 contacts across 418 accounts
```

**Step 2: Open Campaign Builder**
```
Select filtered contacts → Actions ▼ → "Build Campaign"
```

**Step 3: Deduplication Strategy**
```
Multiple contacts per account? Choose strategy:
  ○ Highest seniority (recommended for ABM)
  ○ Best persona match (recommended for role-based)
  ○ Highest reachability (recommended for email campaigns)
  ○ All contacts (no deduplication)
  ○ Custom: Max 3 contacts per account
```

**Step 4: Campaign Details**
```
Campaign Name: (Auto-generated) "2025-11-Q4-HighFit-Sales-VPs-North-America"

Export Options:
  ☐ Salesforce Campaign
  ☐ HubSpot List
  ☐ CSV Export
  ☐ Outreach Sequence
  ☐ SalesLoft Cadence

Fields to Export:
  ✓ Account Name, Domain, Industry, Employees
  ✓ Contact Name, Email, Phone, Title
  ✓ ICP Score, Persona Match, Reachability
  ✓ LinkedIn URL, Account LinkedIn
  ☐ Custom fields: [+ Add]
```

**Step 5: Export**
```
Push to Salesforce:
  - Create campaign: "LaunchPulse - Q4 High-Fit VPs"
  - Add 1,247 campaign members
  - Update contact fields (LaunchPulse Score, etc.)
  - Estimated time: 3-5 minutes

Or Download CSV:
  - Filename: campaign_2025_11_26_highfit.csv
  - 1,247 rows
  - Ready for import to any tool
```

## Bulk Actions

**Available Actions:**

### 1. Bulk Enrichment
```
Select contacts → Actions ▼ → Enrich Selected Contacts
(See "Lead Enrichment" section above)
```

### 2. Verify Emails
```
Select contacts → Actions ▼ → Verify Emails
(See "Email Verification" section above)
```

### 3. Add to Campaign
```
Select contacts → Actions ▼ → Build Campaign
(See "Campaign Building" section above)
```

### 4. Link to Account
```
Select orphaned contacts → Actions ▼ → Link to Account

Auto-matching:
  - By email domain
  - By company name (fuzzy match)
  
Manual matching:
  - Search and select account
```

### 5. Merge Duplicates
```
Select duplicate contacts → Actions ▼ → Merge Contacts

Merge strategy:
  - Keep contact with most complete data
  - Merge activity history
  - Preserve all email addresses
```

### 6. Export to CSV
```
Select contacts → Actions ▼ → Export to CSV

Choose columns (all selected by default)
Download: contacts_export_2025_11_26.csv
```

### 7. Delete Contacts
```
Select contacts → Actions ▼ → Delete Selected

⚠️ Warning: This action cannot be undone
Deleted contacts moved to trash (recoverable for 30 days)
```

## Best Practices

### Effective Contact Management

**Weekly Review Workflow (20 minutes):**
1. **Monday**: Review new contacts from CRM sync
2. **Tuesday**: Enrich high-priority contacts (A/B accounts)
3. **Wednesday**: Verify emails for campaign-ready contacts
4. **Thursday**: Build weekly campaign (top 100 contacts)
5. **Friday**: Review campaign performance, adjust personas

### Persona Optimization

**Quarterly Persona Review:**
1. **Export contacts with high engagement**
   - Filter: Email open rate > 30%
   - Filter: Response rate > 5%
2. **Analyze common attributes**
   - Most common titles
   - Most common seniority levels
   - Most common departments
3. **Update ICP persona criteria**
   - Settings → ICP Manager → Edit Persona
4. **Re-score contacts**
   - Bulk re-calculate persona match scores

### Contact Discovery Strategy

**Prioritize discovery by account value:**
1. **Tier 1**: A band accounts with < 3 contacts
2. **Tier 2**: B band accounts with 0 contacts
3. **Tier 3**: A/B band accounts (add more contacts)

**Budget allocation:**
- Allocate 60% of enrichment budget to Tier 1
- Allocate 30% to Tier 2
- Allocate 10% to Tier 3

### Data Hygiene

**Monthly Cleanup (30 minutes):**
1. **Merge duplicates**
   - Filter: Duplicate email addresses
   - Merge into single contact
2. **Remove bounced emails**
   - Filter: Email status = bounced
   - Remove or mark as invalid
3. **Unlink orphaned contacts**
   - Filter: Account = null
   - Link to accounts or delete
4. **Archive inactive contacts**
   - Filter: No activity in 180 days + Low reachability
   - Archive or delete

## Troubleshooting

### Issue: Contacts Not Linking to Accounts

**Cause:** Email domain doesn't match account domain

**Fix:**
1. Check account domain is correct
2. Manually link contact to account (Actions → Link to Account)
3. Update domain alias in Settings → Data Quality → Domain Aliases

### Issue: Low Persona Match Scores

**Cause:** Persona criteria too narrow or misaligned

**Fix:**
1. Review persona criteria in ICP Manager
2. Expand job title keywords (include variations)
3. Include related departments
4. Re-score contacts after persona update

### Issue: Email Verification Failing

**Cause:** SMTP server blocking verification attempts

**Fix:**
1. Try again later (rate limit may be hit)
2. Manually verify critical emails (send test email)
3. Use alternative verification provider (Settings → Enrichment → Email Verification)

### Issue: Contact Discovery Finding No Contacts

**Cause:** Persona criteria too specific or account domain incorrect

**Fix:**
1. Broaden job title criteria (e.g., "VP" instead of "Vice President of Sales")
2. Check account domain is correct (Google the company)
3. Try different enrichment provider (PDL vs ZoomInfo)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search bar |
| `↑` `↓` | Navigate contact rows |
| `Enter` | Open selected contact detail drawer |
| `Esc` | Close detail drawer |
| `Ctrl+A` | Select all contacts |
| `Ctrl+E` | Enrich selected contacts |
| `Ctrl+B` | Build campaign from selected |

## Related Documentation

- [Account Management Guide](./Account_Management_Guide.md)
- [Campaign Builder Guide](./Campaign_Builder_Guide.md)
- [ICP Manager Guide](./ICP_Manager_Guide.md)
- [Scoring Insights Guide](./Scoring_Insights_Guide.md)

## Support

For lead management questions:
- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **Live Chat**: Click ? icon in bottom right

---

**Guide Version:** 1.0  
**Last Updated:** 2025-11-26  
**Applies to:** LaunchPulse v2.0+
