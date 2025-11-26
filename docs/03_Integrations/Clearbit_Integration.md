# Clearbit Integration Guide

## Overview

LaunchPulse uses Clearbit's free Enrichment API to provide no-cost account enrichment. This is the default enrichment provider for basic firmographic data.

## Features

- **Free Enrichment**: No API key required, no cost
- **Company Lookup**: Basic firmographic data by domain
- **Logo Retrieval**: Company logos for UI
- **Industry Classification**: Standard industry categories
- **Basic Firmographics**: Employee range, location, description

## Setup

No setup required! LaunchPulse uses Clearbit's free tier automatically.

**Access:** Settings → Data Quality → Enrichment → Clearbit (Free)

## Enrichment Capabilities

### Free Tier Data
Clearbit free enrichment provides:

- Company name
- Domain
- Logo URL
- Industry category
- Employee range (e.g., "51-250")
- Location (city, state, country)
- Description
- Founded year
- Website URL
- Social media links (LinkedIn, Twitter, Facebook)

### Limitations
- **Rate Limits**: 200 requests per hour
- **Data Depth**: Basic data only (no revenue, tech stack, etc.)
- **Coverage**: Public companies prioritized
- **Accuracy**: Good for well-known companies, limited for small/private companies

## Use Cases

### Initial Enrichment
Use Clearbit as the first enrichment step:

**Workflow:**
1. Account created with domain
2. LaunchPulse calls Clearbit free API
3. Basic data populated
4. If insufficient, escalate to paid providers (Apollo, ZoomInfo)

### Logo Display
Retrieve company logos for UI:

**Usage:**
- Executive dashboard company cards
- Account detail drawers
- Campaign builder preview
- Reports and exports

**Implementation:**
```typescript
const logoUrl = `https://logo.clearbit.com/${domain}`;
```

### Industry Normalization
Use Clearbit's industry categories as base:

**Process:**
1. Clearbit provides industry string
2. LaunchPulse normalizes to standard taxonomy
3. Maps to ZoomInfo industries (if using ZoomInfo)
4. Used in ICP matching

## Smart Enrichment Strategy

LaunchPulse uses a waterfall approach:

**Waterfall Order:**
1. **Clearbit (Free)**: Try first for all accounts
2. **Apollo**: If Clearbit returns insufficient data
3. **ZoomInfo**: For high-priority accounts (A/B band)
4. **PDL**: For contact-level data

**Configuration:**
- Settings → Data Quality → Smart Enrichment
- Enable/disable providers in order
- Set credit budgets for paid providers
- Define "insufficient data" thresholds

## Edge Function

LaunchPulse includes a dedicated edge function for Clearbit free enrichment:

**Function:** `enrich-clearbit-free`
**Endpoint:** `/functions/v1/enrich-clearbit-free`

**Usage:**
```typescript
const { data, error } = await supabase.functions.invoke('enrich-clearbit-free', {
  body: { domain: 'acme.com', org_id: 'xxx' }
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Acme Corporation",
    "domain": "acme.com",
    "logo": "https://logo.clearbit.com/acme.com",
    "industry": "Software",
    "employee_count": "51-250",
    "location": "San Francisco, CA, US",
    "description": "Enterprise software solutions..."
  },
  "source": "clearbit_free"
}
```

## Rate Limiting

Clearbit free tier limits:
- **Requests**: 200 per hour
- **Retries**: 3 attempts with backoff
- **Throttling**: Automatic queue when approaching limit

LaunchPulse handles this automatically:
- Queues requests when near limit
- Retries failed requests
- Falls back to paid providers if limit exceeded

## Data Quality

### Accuracy
- **Well-known companies**: 95%+ accurate
- **Startups**: 70-80% accurate
- **Very small companies**: 40-60% accurate (limited coverage)

### Coverage
- **US companies**: 80%+ coverage
- **EU companies**: 60% coverage
- **Other regions**: 30-50% coverage
- **Private companies**: Lower coverage

## Comparison to Paid Providers

| Feature | Clearbit Free | Apollo | ZoomInfo |
|---------|---------------|--------|----------|
| Cost | Free | $1-2/credit | $2-3/credit |
| Employee Count | Range | Exact | Exact + Trend |
| Revenue | No | Estimate | Actual |
| Tech Stack | No | Yes | Yes (detailed) |
| Contacts | No | Yes | Yes |
| Intent Data | No | Yes | Yes |
| Funding | No | Yes | Yes |
| Coverage | 60-70% | 80-90% | 95%+ |

**Recommendation:**
- Use Clearbit for all accounts initially (it's free!)
- Escalate to paid providers for high-priority accounts
- Re-enrich with paid providers when scores reach A/B band

## Best Practices

1. **Always Try First**: Clearbit is free, so always attempt enrichment
2. **Logo Caching**: Cache logos to reduce API calls
3. **Rate Limit Awareness**: Don't bulk enrich >200 accounts/hour
4. **Data Validation**: Verify Clearbit data against other sources
5. **Paid Escalation**: Use paid providers for missing critical fields

## Troubleshooting

### No Data Returned
- **Domain not found**: Very small company or wrong domain
- **Rate limit**: Wait 1 hour or use paid provider
- **Service unavailable**: Clearbit API temporarily down (retry)

### Incorrect Data
- **Wrong company**: Domain redirects or acquisitions
- **Outdated**: Clearbit data can lag (use paid provider for fresh data)
- **Ambiguous**: Multiple companies with similar names

### Rate Limiting Issues
- **429 errors**: Hitting rate limit, automatic retry in 1 hour
- **Queue building**: Many accounts enriching, lower priority requests queued

## Support Resources

- Edge Function: `enrich-clearbit-free/index.ts`
- Smart Enrichment: Settings → Data Quality
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
- Enrichment History: Settings → Data Quality → Enrichment History
