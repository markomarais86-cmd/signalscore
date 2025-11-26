# Apollo.io Integration Guide

## Overview

LaunchPulse integrates with Apollo.io to enrich account data and discover contacts at target accounts. This enables teams to find decision-makers at high-fit accounts.

## Features

- **Account Enrichment**: Enhance firmographic data from Apollo's database
- **Contact Discovery**: Find contacts at scored accounts
- **Email Verification**: Validate email deliverability
- **Intent Data**: Access Apollo's buyer intent signals
- **Technology Detection**: Identify tech stack usage
- **Funding Data**: Get latest funding information
- **Credit Management**: Track Apollo credit usage

## Setup Requirements

### Prerequisites
1. Apollo.io account (Professional or higher recommended)
2. API key with enrichment permissions
3. Available credits in Apollo account

### Initial Setup

Refer to `APOLLO_SETUP.md` for detailed configuration.

**Quick Start:**
1. Get Apollo API key from https://app.apollo.io/settings/integrations/api
2. Navigate to Settings → Integrations → Enrichment Providers
3. Click "Configure Apollo"
4. Enter API key
5. Set credit limits and preferences

## Enrichment Features

### Account-Level Enrichment
Apollo can enrich these account fields:

- **Firmographics**: Employee count, revenue, industry
- **Technographics**: Technologies used, tech stack categories
- **Funding**: Latest round, total raised, investors
- **Contact Info**: Phone numbers, headquarters address
- **Socials**: LinkedIn, Twitter, Facebook URLs
- **Employee Growth**: Hiring trends, growth rate

### Cost Per Enrichment
- **Basic Account Lookup**: 1 credit
- **With Contacts**: 1 credit + 1 per contact
- **Technology Stack**: Included in account lookup
- **Funding Data**: Included in account lookup

## Contact Discovery

### Find Contacts at Scored Accounts
1. Score accounts with LaunchPulse ICPs
2. Filter to A/B band accounts
3. Run Apollo contact discovery
4. Apply persona filters (title, seniority, department)
5. Export to campaign

### Discovery Options

**By Persona Criteria:**
- Job titles (e.g., "VP of Sales", "Director of Marketing")
- Seniority levels (C-Level, VP, Director, Manager)
- Departments (Sales, Marketing, Engineering, IT)
- Management level (Executive, Senior, Entry)

**By Contact Quality:**
- Email status (Verified, Likely, Guessed)
- Phone availability
- Direct dial numbers
- Mobile numbers

### Credits Per Contact
- **Email Only**: 1 credit
- **Email + Phone**: 2 credits
- **Mobile Number**: 3 credits
- **Email Verification**: 0.5 credits

## Automated Workflows

### Contact Backfill
Automatically find contacts for accounts missing them:

**Configuration:**
- Settings → Automations → Contact Backfill
- Filter: Accounts with score > 70 AND contact count = 0
- Persona: Specify titles/seniority
- Max contacts: 3 per account (recommended)
- Schedule: Daily at 3 AM

**Credit Budget:**
- Set monthly limit (e.g., 1,000 credits)
- Alerts when 80% consumed
- Auto-pause at limit

### Smart Enrichment
Enrich accounts as they enter your system:

**Triggers:**
- New account created
- Account score reaches A/B band
- Missing critical fields (revenue, employee count)

**Settings:**
- Auto-enrich: Yes/No
- Fields to enrich: Select specific fields
- Credit limit: Daily/monthly caps

## Email Verification

### Bulk Verification
Verify email deliverability for contacts:

1. Select contact segment
2. Choose "Verify Emails (Apollo)" action
3. Review credit cost estimate
4. Execute verification
5. View results in contact list

### Verification Results
- **Valid**: Email exists and accepts mail
- **Invalid**: Email doesn't exist
- **Catchall**: Server accepts all emails (uncertain)
- **Unknown**: Unable to verify

**Credit Cost:** 0.5 credits per email

## Intent Data Integration

### Buyer Intent Signals
Apollo provides intent data showing accounts researching topics:

- **Topics Researched**: Keywords and categories
- **Intent Score**: 0-100 intensity
- **Recency**: When signals were detected
- **Confidence**: Data reliability score

**Usage in LaunchPulse:**
- Boost propensity scores for accounts showing intent
- Create "High Intent" segments
- Trigger outreach campaigns

**Configuration:**
- Settings → Integrations → Apollo → Intent Data
- Map intent topics to your ICPs
- Set score boost amount (e.g., +10 to propensity)

## Technology Stack Detection

### Tech Stack Enrichment
Apollo identifies technologies used by accounts:

**Categories:**
- Marketing automation (HubSpot, Marketo, etc.)
- CRM systems (Salesforce, HubSpot CRM)
- Analytics (Google Analytics, Mixpanel)
- Infrastructure (AWS, Azure, GCP)
- E-commerce (Shopify, Magento)

**Use Cases:**
- ICP definition (e.g., "Salesforce users")
- Competitive insights
- Replacement opportunities
- Integration partners

**Cost:** Included in account enrichment (no extra credits)

## Credit Management

### Monitor Usage
Track Apollo credit consumption:

**Dashboard:** Settings → Integrations → Apollo → Usage
- Credits used this month
- Credits remaining
- Cost breakdown by operation
- Trend graph

### Budget Controls
Prevent overspending:

1. **Monthly Cap**: Set max credits per month
2. **Daily Limit**: Throttle daily usage
3. **Alerts**: Email at 50%, 80%, 100%
4. **Auto-Pause**: Stop enrichment at limit
5. **Priority Queue**: Enrich A-band accounts first

### Cost Optimization
Tips to reduce credit usage:

- Use LaunchPulse's built-in enrichment first (Clearbit free)
- Enable smart enrichment (only when needed)
- Set persona filters before discovery (fewer contacts)
- Verify emails only for campaign exports
- Batch operations instead of real-time
- Use ZoomInfo for bulk enrichment if available

## API Rate Limits

Apollo imposes rate limits:
- **Requests**: 200 per minute
- **Daily Cap**: Based on plan tier
- **Concurrent**: 10 simultaneous requests

LaunchPulse handles this automatically with:
- Request queuing
- Exponential backoff
- Batch processing
- Retry logic

## Troubleshooting

### Common Issues

**Enrichment Failures**
- Verify API key is valid (check Apollo dashboard)
- Ensure credits are available
- Check rate limit status
- Review error logs

**No Contacts Found**
- Broaden persona criteria (fewer filters)
- Check account has employees in Apollo database
- Try alternative titles (e.g., "VP Sales" vs "Vice President of Sales")
- Some private companies have limited data

**Credit Discrepancy**
- LaunchPulse estimates may differ from actual
- Apollo charges per API call, not per result
- Failed requests still consume credits
- Review detailed logs in enrichment history

**Duplicate Contacts**
- Use deduplication in Settings → Data Quality
- Apollo may return same contact with different emails
- LaunchPulse merges by name + company

### Best Practices

1. **Start Small**: Test with 10-20 accounts first
2. **Use Filters**: Narrow persona criteria to reduce costs
3. **Monitor Credits**: Check usage daily initially
4. **Quality Over Quantity**: 3 good contacts > 10 weak ones
5. **Verify Strategically**: Only verify emails you'll contact soon
6. **Combine Sources**: Use multiple enrichment providers

## Integration with Campaign Builder

### Workflow
1. **Score Accounts**: Run LaunchPulse scoring
2. **Filter**: Select A/B band accounts
3. **Enrich**: Run Apollo contact discovery
4. **Validate**: Apply reachability filters
5. **Export**: Push to CRM or CSV

### Campaign Builder Options
When building campaigns:
- "Find Contacts (Apollo)" button
- Configure persona filters
- Set max contacts per account
- Estimate credit cost
- Review before execution

## Weekly Contact Discovery

Automate contact discovery on a schedule:

**Setup:** See `APOLLO_WEEKLY_SYNC_SETUP.sql`
1. Create cron job for weekly execution
2. Configure target ICPs and score thresholds
3. Set persona criteria
4. Define credit budget
5. Choose notification recipients

**Process:**
- Runs every Monday at 6 AM (configurable)
- Finds contacts for high-fit accounts
- Respects credit limits
- Emails summary report

## Redemption Credits

LaunchPulse offers Apollo redemption credits for eligible customers:

**Eligibility:**
- New LaunchPulse customers
- Committed annual contract
- Use case aligned with Apollo

**Configuration:** See `ApolloRedemptionDialog.tsx` component
- Redeem credits from Settings → Integrations → Apollo
- Enter redemption code
- Credits applied to account balance

## Support Resources

- Setup Guide: `APOLLO_SETUP.md`
- Weekly Sync: `APOLLO_WEEKLY_SYNC_SETUP.sql`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
- Enrichment Overview: Settings → Data Quality → Enrichment
