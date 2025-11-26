# People Data Labs (PDL) Integration Guide

## Overview

LaunchPulse integrates with People Data Labs (PDL) to provide person-level enrichment, contact discovery, and email verification at scale. PDL offers competitive pricing and broad coverage.

## Features

- **Person Enrichment**: Enrich contacts with job title, seniority, department
- **Contact Discovery**: Find contacts at accounts by persona criteria
- **Email Validation**: Verify email deliverability
- **Company Enrichment**: Alternative to other providers
- **Bulk Operations**: Process thousands of records efficiently
- **Cost-Effective**: Lower pricing than alternatives

## Setup Requirements

### Prerequisites
1. People Data Labs API key
2. Available credits in PDL account
3. Understanding of credit pricing model

### Initial Setup

Refer to `PDL_SETUP.md` for detailed configuration.

**Quick Start:**
1. Sign up at https://dashboard.peopledatalabs.com/
2. Obtain API key from dashboard
3. Settings → Integrations → Enrichment Providers → PDL
4. Enter API key
5. Set credit budget
6. Test connection

## Enrichment Capabilities

### Person-Level Data
PDL enriches contacts with:

**Professional Info:**
- Full name (cleaned)
- Current job title
- Seniority level (C-Suite, VP, Director, Manager, Individual Contributor)
- Department/function (Sales, Marketing, Engineering, etc.)
- Start date at current role
- LinkedIn URL
- Email (work, personal)
- Phone numbers (mobile, work)

**Historical Data:**
- Previous companies and roles
- Education background
- Skills and certifications
- Inferred interests
- Social media profiles

**Company Association:**
- Current company name and domain
- Company size and industry
- Location

### Company-Level Data
PDL can also enrich companies:

- Company name variations
- Website and domain
- Industry classifications
- Employee count
- Founded year
- Headquarters location
- All company locations
- Company type (Public, Private, Nonprofit)
- LinkedIn company page

### Email Validation
Verify email deliverability:

**Validation Levels:**
- **Valid**: Email exists and accepts mail (95%+ deliverability)
- **Risky**: Email may exist but has issues (70-80% deliverability)
- **Invalid**: Email does not exist or is bounced
- **Unknown**: Unable to verify

**Cost:** 0.25 credits per email

## Contact Discovery

Find contacts at target accounts:

**Process:**
1. Provide company domain or name
2. Specify persona criteria:
   - Job titles (e.g., "VP of Sales", "Director of Marketing")
   - Seniority levels (C-Level, VP, Director)
   - Departments (Sales, Marketing, Engineering)
   - Management role (Yes/No)
3. PDL returns matching contacts
4. Optionally validate emails

**Cost:** 1 credit per contact returned

### Persona Filters

**Title Matching:**
- Exact match: "Chief Financial Officer"
- Contains: "VP" or "Vice President"
- Role-based: "Finance Leader", "Sales Executive"

**Seniority Levels:**
- Owner/Partner
- C-Level (CEO, CFO, CTO, etc.)
- VP
- Director
- Manager
- Individual Contributor
- Intern

**Departments:**
- Sales
- Marketing
- Customer Success
- Engineering/IT
- Finance
- HR/People Ops
- Operations
- Legal
- Product

**Management:**
- Is Manager: Yes/No filter
- Direct reports: Has/doesn't have direct reports

## Bulk Enrichment

Process large datasets efficiently:

**Component:** `BulkLeadEnrichment.tsx`
**Location:** Settings → Data Quality → Bulk Enrichment → Contacts

**Process:**
1. Upload CSV with emails or names+companies
2. Map columns to PDL input fields
3. Select enrichment options
4. Set credit budget and limits
5. Review cost estimate
6. Execute bulk job

**Features:**
- Progress monitoring
- Pause/resume capability
- Error handling
- Credit tracking
- Result preview
- Export enriched data

**Batch Sizes:**
- Recommended: 100-500 records per batch
- Maximum: 10,000 records per batch
- Parallel processing: Up to 5 batches simultaneously

## Edge Function

PDL enrichment is handled by edge function:

**Function:** `enrich-pdl`
**Endpoint:** `/functions/v1/enrich-pdl`

**Request:**
```json
{
  "type": "person",
  "email": "john@acme.com",
  "org_id": "xxx",
  "enrich_company": true
}
```

**Response:**
```json
{
  "success": true,
  "person": {
    "full_name": "John Smith",
    "title": "VP of Sales",
    "seniority": "VP",
    "department": "Sales",
    "linkedin_url": "linkedin.com/in/johnsmith",
    "email_status": "valid",
    "company_domain": "acme.com"
  },
  "company": {
    "name": "Acme Corporation",
    "domain": "acme.com",
    "employee_count": 250,
    "industry": "Software"
  },
  "credits_used": 1,
  "confidence": 95
}
```

## Credit Management

### Pricing Model
PDL uses credit-based pricing:

- **Person Enrichment**: 1 credit per person
- **Company Enrichment**: 1 credit per company
- **Email Validation**: 0.25 credits per email
- **Bulk Discounts**: Available for >100K credits

### Budget Controls

**Settings:** Settings → Integrations → PDL → Budget

**Controls:**
- Monthly credit limit
- Daily credit limit
- Alerts at thresholds (50%, 80%, 100%)
- Auto-pause at limit
- Cost per credit (for reporting)

### Usage Monitoring

**Dashboard:** Settings → Integrations → PDL → Usage

**Metrics:**
- Credits used (today, this week, this month)
- Credits remaining
- Cost (if price configured)
- Operations breakdown (person, company, validation)
- Trend graph

## Contact Backfill Automation

Automatically find contacts at high-fit accounts:

**Component:** `ContactsBackfill.tsx`
**Configuration:** Settings → Automations → Contact Backfill (PDL)

**Setup:**
1. Filter accounts (score band, missing contacts)
2. Define persona criteria
3. Set max contacts per account (3-5 recommended)
4. Set credit budget (daily/monthly)
5. Schedule or run once

**Process:**
- Queries PDL API for contacts matching persona
- Validates emails (optional)
- Links contacts to accounts
- Updates reachability scores
- Logs all operations

## Data Quality

### Accuracy Metrics
PDL maintains high data quality:

- **Person data**: 90%+ accuracy
- **Email deliverability**: 95%+ for "valid" status
- **Company data**: 85%+ accuracy
- **Phone numbers**: 80%+ connect rate

### Data Freshness
- Updated quarterly
- Job change tracking
- Company updates monthly
- Email validation on-demand

### Coverage
- **Global database**: 3B+ person profiles
- **US**: 95% coverage of professionals
- **EU**: 80% coverage
- **APAC**: 60% coverage
- **Company coverage**: 150M+ companies worldwide

## Compliance

PDL is compliant with:
- **GDPR**: EU data regulations, right to be forgotten
- **CCPA**: California privacy laws
- **CAN-SPAM**: Email marketing compliance
- **TCPA**: Telephone contact rules

**LaunchPulse Features:**
- Consent management integration
- Do-not-contact list respect
- Data retention controls
- Audit trail

## API Rate Limits

PDL enforces rate limits:
- **Requests**: 600 per minute
- **Concurrent**: 10 simultaneous connections
- **Daily**: Based on credit allocation

LaunchPulse handles limits:
- Automatic request queuing
- Exponential backoff
- Batch processing
- Rate limit monitoring

## Troubleshooting

### Common Issues

**No Results Found**
- **Person not in database**: Try alternative email/LinkedIn
- **Company too small**: Limited coverage for <10 employee companies
- **Spelling errors**: Verify name spelling
- **Recent job change**: Data may not be updated yet

**Email Validation Fails**
- **Catchall domain**: Domain accepts all emails (marked "risky")
- **Privacy settings**: Email hidden by company policies
- **Disposable email**: Temporary email services blocked

**Credit Consumption Higher Than Expected**
- **Failed requests**: PDL charges for API call, even if no result
- **Company enrichment**: Automatically included (1 extra credit)
- **Bulk operations**: May re-enrich existing records
- Review enrichment history for details

**Rate Limiting**
- **429 errors**: Too many requests, automatic retry
- **Slow performance**: High API load, increase batch delays
- **Queue building**: Many operations pending, lower priority queued

### Best Practices

1. **Email First**: Search by email (most accurate identifier)
2. **LinkedIn Fallback**: If email fails, use LinkedIn URL
3. **Validate Strategically**: Only validate emails for active campaigns
4. **Bulk Operations**: Use bulk endpoint for >100 enrichments
5. **Cache Results**: Don't re-enrich recently enriched contacts
6. **Persona Specificity**: Narrow criteria = better quality, lower cost
7. **Monitor Credits**: Review usage weekly to avoid surprises

## Comparison to Other Providers

| Feature | PDL | Apollo | ZoomInfo |
|---------|-----|--------|----------|
| Cost (person) | $1.00 | $1.50 | $2.50 |
| Coverage | 3B profiles | 250M | 200M |
| Email validation | 0.25 credits | Included | Included |
| Bulk pricing | Yes | Yes | Yes |
| Global coverage | Excellent | Good | Good (US-focused) |
| API speed | Fast | Medium | Fast |
| Tech stack | Limited | Yes | Yes (best) |
| Intent data | No | Yes | Yes |

**When to use PDL:**
- Cost-sensitive use cases
- Global contact discovery
- Bulk enrichment needs
- Person-level data primary focus
- Email validation at scale

**When to use alternatives:**
- Need tech stack data (Apollo/ZoomInfo)
- Need intent signals (Apollo/ZoomInfo)
- Focus on enterprise accounts (ZoomInfo)
- Already using their CRM data (Apollo)

## Integration with Campaign Builder

### Workflow
1. Score accounts with LaunchPulse
2. Filter to A/B band accounts
3. Run PDL contact discovery
4. Validate emails (optional)
5. Apply reachability filters
6. Export to campaign

### Campaign Builder Features
- "Find Contacts (PDL)" button
- Persona filter builder
- Email validation toggle
- Credit cost estimator
- Preview before execution

## Support Resources

- Setup Guide: `PDL_SETUP.md`
- Bulk Enrichment: `BulkLeadEnrichment.tsx` component
- Contact Backfill: `ContactsBackfill.tsx` component
- Edge Function: `enrich-pdl/index.ts`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
