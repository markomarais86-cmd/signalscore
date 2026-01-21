# Enrichment System Consolidation Guide

## Overview

The enrichment system has been consolidated from 40+ edge functions to a unified architecture with a single entry point.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   enrich-unified                             │
│            (Single Entry Point for All Enrichment)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               _shared/provider-waterfall.ts                  │
│                                                              │
│  Step 1: Email Name Extraction (free)                       │
│  Step 2: Perplexity AI Search (primary discovery)           │
│  Step 3: Firecrawl Website Scrape (ground truth)            │
│  Step 4: Claude/Gemini/Grok AI (gap filling)                │
│  Step 5: PDL (paid fallback)                                │
│  Step 6: Apollo (last resort)                               │
│  Step 7: Hunter Email Verification                          │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Frontend Hook

```tsx
import { useUnifiedEnrichment } from '@/hooks/use-unified-enrichment';

function MyComponent() {
  const { enrichAccounts, enrichLeads, isEnriching, progress } = useUnifiedEnrichment({
    onComplete: (result) => console.log('Done!', result),
  });

  const handleEnrich = async () => {
    await enrichAccounts(orgId, accounts, {
      skipPaidProviders: false,
      maxCost: 0.50,
      verifyEmail: true,
    });
  };
}
```

### Direct API Call

```ts
const { data, error } = await supabase.functions.invoke('enrich-unified', {
  body: {
    org_id: 'your-org-id',
    record_type: 'account', // or 'lead'
    records: [
      { external_id: 'acc1', name: 'Acme Corp', domain: 'acme.com' },
    ],
    config: {
      skipPaidProviders: false,
      maxCost: 0.50,
      verifyEmail: true,
      includeWebScrape: true,
    },
  },
});
```

## Deprecated Functions

The following functions are **deprecated** and will be removed in a future release. Migrate to `enrich-unified`:

| Deprecated Function | Replacement |
|---------------------|-------------|
| `smart-enrich` | `enrich-unified` with `record_type: 'account'` |
| `process-enrichment` | `enrich-unified` |
| `enrich-accounts` | `enrich-unified` with `record_type: 'account'` |
| `enrich-fast` | `enrich-unified` (handles small batches automatically) |
| `bulk-enrich-all-accounts` | `enrich-unified` (use batch processing) |
| `enrich-free-orchestrator` | `enrich-unified` with `config.skipPaidProviders: true` |
| `enrich-lead-orchestrator` | `enrich-unified` with `record_type: 'lead'` |

## Functions to Keep

These functions remain active and serve specific purposes:

### Core
- `enrich-unified` - **Primary entry point** for all enrichment
- `enrichment-orchestrator` - For large batch jobs with background processing
- `enrich-v4` - Lightweight single-record enrichment

### Specialized
- `enrich-hq-address` - Address normalization
- `lookup-naics` - NAICS/SIC code lookup
- `enrich-verified` - Apollo/PDL verified data
- `verify-phones` - Phone number verification

### Agents
- `agent-search-enrichment` - AI-powered research
- `agent-discover-contacts` - Contact discovery
- `agent-validation-scoring` - Data validation

### Provider-Specific (Internal)
- `enrich-gemini-account` - Gemini AI enrichment
- `enrich-gemini-phones` - Phone discovery
- `enrich-perplexity` - Perplexity search
- `enrich-perplexity-contact` - Contact search
- `firecrawl-scrape` - Website scraping

## Migration Guide

### From `smart-enrich`

Before:
```ts
await supabase.functions.invoke('smart-enrich', {
  body: { jobId: 'xxx', batchSize: 100 }
});
```

After:
```ts
await supabase.functions.invoke('enrich-unified', {
  body: {
    org_id: 'xxx',
    record_type: 'account',
    records: accounts,
    config: { skipPaidProviders: false }
  }
});
```

### From `enrich-free-orchestrator`

Before:
```ts
await supabase.functions.invoke('enrich-free-orchestrator', {
  body: { org_id: 'xxx', job_id: 'yyy' }
});
```

After:
```ts
await supabase.functions.invoke('enrich-unified', {
  body: {
    org_id: 'xxx',
    record_type: 'account',
    records: accounts,
    config: { skipPaidProviders: true }
  }
});
```

## Cost Estimates

| Provider | Cost per Record |
|----------|-----------------|
| Email Parse | $0.00 |
| Perplexity | $0.005 |
| Firecrawl | $0.002 |
| AI (Gemini) | $0.001 |
| AI (Claude) | $0.003 |
| AI (Grok) | $0.002 |
| PDL | $0.10 |
| Apollo | $0.05 |
| Hunter | $0.015 |

The waterfall is designed to maximize data quality while minimizing cost. Paid providers (PDL/Apollo) are only used if:
1. `skipPaidProviders` is `false`
2. Key data (employee_count, revenue_range, industry) is still missing
3. Total cost is under `maxCost` (default: $0.50)

## Verified Fields

Data from the official website (Step 3: Firecrawl) is treated as **ground truth** and cannot be overwritten by subsequent AI or API lookups. This ensures data accuracy for:
- Company name
- Phone number
- City, State, Country
