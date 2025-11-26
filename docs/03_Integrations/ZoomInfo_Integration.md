# ZoomInfo Integration Guide

## Overview

LaunchPulse integrates with ZoomInfo to provide enterprise-grade account and contact enrichment. ZoomInfo offers the most comprehensive B2B database with advanced firmographic, technographic, and intent data.

## Features

- **Enterprise Account Data**: Deep firmographic intelligence
- **Org Charts**: Map decision-makers and reporting structure
- **Scoops**: Real-time business intelligence alerts
- **Intent Signals**: Topic-based buyer intent tracking
- **Technographics**: Detailed technology stack analysis
- **Financials**: Revenue, growth trends, funding data
- **Job Changes**: Track executive movements

## Setup Requirements

### Prerequisites
1. ZoomInfo Professional or Advanced subscription
2. API access enabled (contact ZoomInfo CSM)
3. Sufficient credits/licenses in ZoomInfo account
4. IP whitelisting configured

### Initial Setup

Refer to `ZOOMINFO_SETUP.md` for detailed configuration.

**Quick Start:**
1. Obtain ZoomInfo API credentials from your CSM
2. Configure IP whitelisting (if required)
3. Navigate to Settings → Integrations → Enrichment Providers
4. Click "Configure ZoomInfo"
5. Enter username and password (or API token)
6. Test connection
7. Configure enrichment preferences

## Enrichment Capabilities

### Account-Level Data
ZoomInfo enriches with extensive firmographic data:

**Basic Firmographics:**
- Company name (legal and DBA)
- Domain and email patterns
- Headquarters address (full details)
- Phone numbers (HQ and departmental)
- Employee count (current and historical trends)
- Revenue (actual, not ranges)
- Industry (NAICS, SIC, custom taxonomies)

**Advanced Data:**
- Sub-industry classifications
- Business model (B2B, B2C, B2B2C)
- Ownership type (Public, Private, PE-backed)
- Parent/subsidiary relationships
- Office locations (all sites)
- Territory assignments

### Contact Discovery
Find and enrich contacts with precision:

**Contact Attributes:**
- Full name, title, level
- Direct email (work, personal if available)
- Direct dial phone
- Mobile phone
- Department and function
- Reporting structure
- Start date at company
- Previous company/role
- Education background
- Social profiles (LinkedIn, Twitter)

**Targeting Options:**
- Management level (C-Level, VP, Director, Manager, Individual Contributor)
- Department (Sales, Marketing, IT, Finance, HR, etc.)
- Job function (Decision Maker, Influencer, End User)
- Seniority score (0-100)
- Contact accuracy score (verified, inferred)

### Technology Stack
Detailed technographic intelligence:

**Categories:**
- Marketing Automation (30+ tools tracked)
- CRM Systems
- Sales Engagement Platforms
- Customer Success Tools
- Analytics & BI
- Infrastructure & Cloud
- Security Tools
- Communication Platforms
- E-commerce Platforms
- Content Management Systems

**Data Points:**
- Product name and vendor
- Installation date
- Spend estimate (if available)
- User count (if available)
- Renewal date (if available)

**Use Cases:**
- Build ICPs around tech stack ("Salesforce users with Outreach")
- Identify competitive accounts (using competitor's tool)
- Replacement opportunities (legacy system users)
- Integration partner targeting

### Intent Data
Real-time buyer intent signals:

**Intent Topics:**
- 3,000+ topics tracked
- Keyword-level granularity
- Topic taxonomy (categories)

**Intent Metrics:**
- Intensity Score (0-100): Strength of interest
- Recency: When signals detected
- Trend: Increasing/decreasing/stable
- Topics researched: Specific keywords
- Research stage: Early/mid/late stage

**Integration with LaunchPulse:**
- Boost propensity scores for intent matches
- Create "Active Buyers" segments
- Trigger outreach campaigns
- Alert sales on intent spikes

### Scoops (Business Intelligence)

Real-time company news and triggers:

**Scoop Types:**
- **Funding**: Raised round, amount, investors
- **Leadership**: New executives, promotions
- **Expansion**: Office openings, hiring sprees
- **Product**: New product launches
- **Partnership**: Strategic partnerships announced
- **Acquisition**: M&A activity
- **Financial**: Earnings, revenue milestones

**Usage:**
- Create outreach triggers (e.g., new funding → sales alert)
- Personalize messaging with recent news
- Identify high-growth accounts
- Track customer health (if using ZoomInfo for customer data)

## Industry Mapping

ZoomInfo uses proprietary industry classifications. LaunchPulse automatically maps your industries to ZoomInfo taxonomies.

**Process:**
1. Upload your industry list
2. LaunchPulse suggests ZoomInfo mappings
3. Review and confirm mappings
4. Use `map-industry-to-zoominfo` edge function for automation

**Reference:** `ZOOMINFO_SETUP.md` includes industry mapping guide

## Credit Management

ZoomInfo charges credits per enrichment:

**Typical Costs:**
- Basic account lookup: 1 credit
- Full account enrichment: 2-3 credits
- Contact reveal: 1 credit per contact
- Intent data: 0.5 credits per account per month
- Technographics: Included in account enrichment
- Scoops: Included (push notifications)

**LaunchPulse Budget Controls:**
- Set monthly credit limits
- Daily throttling
- Alerts at thresholds (50%, 80%, 100%)
- Auto-pause at limit
- Priority queue (A-band accounts first)
- Cost estimation before bulk operations

**Optimization:**
- Use selective enrichment (only needed fields)
- Leverage ZoomInfo's free data (company name, domain)
- Batch operations to reduce API overhead
- Cache results to avoid re-enrichment

## Automated Workflows

### Smart Enrichment
Auto-enrich accounts based on rules:

**Triggers:**
- New account created with domain
- Account score reaches A/B band
- Missing critical fields (revenue, employee count)
- Weekly refresh for top accounts

**Configuration:**
- Settings → Automations → Smart Enrichment (ZoomInfo)
- Select trigger conditions
- Choose fields to enrich
- Set credit budget
- Enable/disable

### Intent-Based Scoring
Boost propensity scores with intent data:

**Setup:**
1. Define intent topics relevant to your ICPs
2. Map topics to propensity score boosts
3. Enable real-time intent monitoring
4. Configure score refresh frequency

**Example:**
- Topic "CRM Software" detected → +15 propensity points
- Topic "Sales Automation" → +10 points
- Intensity >70 → Additional +5 points

### Scoop Alerts
Get notified of important company changes:

**Configuration:**
- Settings → Integrations → ZoomInfo → Scoops
- Select scoop types (funding, leadership, etc.)
- Filter by account score bands (e.g., A/B only)
- Choose notification method (email, Slack, in-app)
- Set frequency (real-time, daily digest)

## Org Chart Integration

Map organizational structure:

**Features:**
- Visual org chart display
- Reporting relationships
- Decision-making hierarchy
- Multi-site organizations

**Use Cases:**
- Multi-threading strategy (reach multiple decision-makers)
- Identify true economic buyer
- Navigate large enterprises
- Build account maps

**Access:** Account detail drawer → Org Chart tab

## Contact Backfill

Automatically discover contacts at high-fit accounts:

**Configuration:** See `ContactsBackfill.tsx` component
1. Filter accounts (score, industry, size)
2. Define persona criteria
3. Set max contacts per account (3-5 recommended)
4. Set credit budget
5. Schedule (daily, weekly) or run once

**Process:**
- Queries ZoomInfo API for contacts matching persona
- Deduplicates with existing contacts
- Enriches with full contact data
- Links to accounts automatically
- Updates reachability scores

## API Rate Limits

ZoomInfo enforces rate limits:
- **Requests**: 100 per minute (Professional), 200 per minute (Advanced)
- **Daily**: Varies by contract
- **Concurrent**: 5 simultaneous connections

LaunchPulse handles limits:
- Automatic request queuing
- Exponential backoff on errors
- Batch processing (up to 25 records per request)
- Retry logic with timeout
- Rate limit monitoring dashboard

## Data Quality

ZoomInfo maintains high data quality:

**Accuracy:**
- Contact data: 95%+ accuracy
- Company data: 98%+ accuracy
- Phone numbers: 90%+ connect rate
- Emails: 98%+ deliverability

**Freshness:**
- Updated daily
- Job change tracking
- Quarterly verification campaigns
- Crowdsourced validation (ZoomInfo Community)

**LaunchPulse Validation:**
- Cross-reference with other providers
- Email verification (optional)
- Phone validation (optional)
- Confidence scores displayed

## Compliance

ZoomInfo is compliant with:
- **GDPR**: EU data regulations
- **CCPA**: California privacy laws
- **CAN-SPAM**: Email regulations
- **TCPA**: Phone contact rules

**LaunchPulse Features:**
- Consent management integration
- Do-not-contact list enforcement
- Audit trail of data access
- Right to be forgotten support

## Troubleshooting

### Common Issues

**Authentication Failures**
- Verify credentials with ZoomInfo CSM
- Check IP is whitelisted (if required)
- Ensure API access is enabled on account
- Test with ZoomInfo's API explorer first

**No Results Found**
- Domain not in ZoomInfo database (very rare)
- Company too small (<10 employees may have limited data)
- Recently founded (may not be indexed yet)
- Try alternative domains (e.g., www vs non-www)

**Credit Consumption Higher Than Expected**
- Review enrichment settings (may be enriching too many fields)
- Check for duplicate requests (API calls logged)
- Verify caching is enabled
- Contact ZoomInfo CSM to review usage

**Intent Data Not Appearing**
- Ensure intent topics are configured
- Verify intent add-on is active on ZoomInfo account
- Check lookback window (default 30 days)
- Not all accounts will have intent signals

**Industry Mapping Issues**
- Use `map-industry-to-zoominfo` edge function
- Refer to `zoominfo-industries.ts` constant file
- Manual mapping in Settings → Integrations → ZoomInfo
- Contact LaunchPulse support for custom mappings

## Best Practices

1. **Selective Enrichment**: Enrich A/B band accounts first
2. **Persona Precision**: Specific titles = better contact quality
3. **Multi-Threading**: Get 3-5 contacts per account
4. **Intent Monitoring**: Review intent alerts weekly
5. **Verify Emails**: For high-value campaigns only (costs extra)
6. **Org Charts**: Use for strategic accounts ($100K+ deals)
7. **Budget Management**: Set alerts to avoid surprise costs
8. **Data Refresh**: Re-enrich top accounts quarterly

## Integration with Campaign Builder

### Workflow
1. Score accounts with LaunchPulse ICPs
2. Filter to A/B band (high fit)
3. Run ZoomInfo contact discovery
4. Apply persona filters (title, seniority, department)
5. Optionally verify emails
6. Export to campaign

### Campaign Builder Features
- "Find Contacts (ZoomInfo)" button
- Persona builder with ZoomInfo taxonomies
- Credit cost estimator
- Preview results before committing
- Bulk export to CRM or CSV

## Support Resources

- Setup Guide: `ZOOMINFO_SETUP.md`
- Industry Mapping: `zoominfo-industries.ts`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
- Contact Discovery: `ContactDiscovery.tsx` component
- Backfill: `ContactsBackfill.tsx` component
