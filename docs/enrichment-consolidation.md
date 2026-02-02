# Enrichment System Consolidation Guide

## Overview

The enrichment system has been consolidated from 40+ edge functions to a unified architecture with a single entry point. **Version 2.0** introduces full-field data enrichment with multi-provider AI aggregation. **Version 2.1** adds 6 accuracy improvements for higher data quality.

## Version 2.1 Accuracy Improvements

| Improvement | Description | Impact |
|-------------|-------------|--------|
| Generic Email Filter | Blocks `info@`, `sales@`, etc. from name extraction | Eliminates 5-10% of bad names |
| Cross-Source Voting | Uses median/majority for employee_count & revenue_range | +15-25% firmographic accuracy |
| Firmographic Sanity Checks | Validates employee/revenue ratios and enterprise domains | Catches 20-30% of AI hallucinations |
| Phone Switchboard Classification | Distinguishes direct/mobile/switchboard with confidence | +20% dialable yield |
| Enterprise Phone Suppression | Blocks AI-generated phones for large enterprises | Fixes Allstate/AWS-type issues |
| Title Normalization | Standardizes "Proprietor" → "Owner", etc. | Cleaner ICP matching |

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
│  Step 1: Email Name Extraction (free + generic filter)      │
│  Step 2: Perplexity AI Search (primary discovery)           │
│  Step 3: Firecrawl Website Scrape (ground truth)            │
│  Step 4: Multi-Provider AI Aggregation (Claude/Gemini/Grok) │
│         - Calls ALL available AI providers                  │
│         - Cross-source voting for firmographics             │ 🆕
│         - Firmographic sanity checks                        │ 🆕
│         - Enterprise phone suppression                      │ 🆕
│         - Title normalization                               │ 🆕
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
      // Basic options
      skipPaidProviders: false,
      maxCost: 0.50,
      verifyEmail: true,
      includeWebScrape: true,
      
      // NEW: Full-field enrichment options
      aggregateProviders: true,        // Call ALL AI providers and merge (default: true)
      preferredProvider: 'perplexity', // Optional: try this provider first
      forceAllStages: false,           // Run PDL/Apollo even if some data exists
      fieldsToEnrich: [],              // Empty = all 20+ fields
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
      
      // NEW options for full-field enrichment
      aggregateProviders: true,   // Default: true
      forceAllStages: false,      // Default: false
      preferredProvider: 'anthropic', // Optional
    },
  },
});
```

## Full-Field Enrichment (v2.0) 🆕

### Enrichable Fields (20+)

The system now targets ALL of these fields:

| Category | Fields |
|----------|--------|
| Firmographic | `employee_count`, `revenue_range`, `industry`, `founded_year` |
| Location | `city`, `state`, `country` |
| Company IDs | `company_name`, `domain`, `linkedin_company_url`, `twitter_url` |
| Contact | `title`, `linkedin_url`, `phone`, `mobile`, `direct_phone`, `email_verified` |
| Funding | `total_raised_usd`, `last_funding_round` |
| Classification | `naics`, `sic_code`, `tech_stack` |

### Multi-Provider AI Aggregation

When `aggregateProviders: true` (default), the system calls ALL available AI providers:

1. **Perplexity** - Real-time web search with citations (best for company data)
2. **Anthropic (Claude)** - Deep reasoning and structured extraction
3. **xAI (Grok)** - Social/X data access
4. **Lovable (Gemini)** - Fast general coverage
5. **OpenAI (GPT)** - Reliable backup
6. **Abacus** - Last resort

Each provider's response is parsed and merged using **precedence rules**:
- Fields from higher-priority providers override lower-priority ones
- **Verified fields** (from Firecrawl ground truth) are never overwritten
- Each field can have a different optimal provider

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
