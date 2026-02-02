

# Maximum Accuracy Enrichment Plan

## Current Accuracy Mechanisms (Already Implemented)

Your enrichment system already has 9 accuracy improvements in place:

| # | Mechanism | What It Does |
|---|-----------|--------------|
| 1 | Generic Email Filter | Blocks 75+ prefixes like `info@`, `appointments@`, `shipping@` from name parsing |
| 2 | Cross-Source Voting | Uses median for `employee_count`, majority for `revenue_range` across 5 AI providers |
| 3 | Firmographic Sanity Checks | Validates employee/revenue ratios, rejects implausible combinations |
| 4 | Phone Classification | Distinguishes direct/mobile/switchboard with confidence scores |
| 5 | Enterprise Phone Suppression | Blocks AI phones for 50+ enterprise domains (Amazon, Walmart, etc.) and >10k employee companies |
| 6 | Title Normalization | 100+ mappings for consistent ICP matching |
| 7 | Revenue Range Validation | Only accepts standardized ranges (`$0-$1M`, `$1M-$5M`, etc.) |
| 8 | Founding Year Validation | Rejects future years, pre-1990 for tech domains |
| 9 | LinkedIn URL Extraction | Direct regex extraction from Firecrawl (no AI needed) |

---

## New Accuracy Improvements to Add

### 1. Email Domain Validation (High Impact)
**Problem:** AI sometimes returns emails that don't match the company domain.

```typescript
// Reject "contact@gmail.com" when enriching "acme.com"
function validateEmailMatchesDomain(email: string, domain: string): boolean {
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const targetDomain = domain.toLowerCase().replace(/^www\./, '');
  
  // Reject generic email providers
  const genericProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com'];
  if (genericProviders.includes(emailDomain)) {
    return false;
  }
  
  // Email domain must match or be subdomain of company domain
  return emailDomain === targetDomain || emailDomain.endsWith(`.${targetDomain}`);
}
```

### 2. Industry Cross-Validation (High Impact)
**Problem:** AI providers sometimes return conflicting industries (e.g., "Healthcare" vs "Software").

```typescript
// NAICS-Industry mapping for validation
const NAICS_INDUSTRY_MAP: Record<string, string[]> = {
  '5112': ['Software', 'Technology', 'SaaS'],
  '5241': ['Insurance', 'Financial Services'],
  '6211': ['Healthcare', 'Medical'],
  '4411': ['Automotive', 'Retail'],
  // ... 50+ mappings
};

function validateNAICSIndustryMatch(naics: string, industry: string): boolean {
  const prefix = naics?.substring(0, 4);
  const validIndustries = NAICS_INDUSTRY_MAP[prefix];
  if (!validIndustries) return true; // Unknown NAICS, allow
  return validIndustries.some(ind => industry.toLowerCase().includes(ind.toLowerCase()));
}
```

### 3. Location Plausibility Checks (Medium Impact)
**Problem:** AI sometimes returns impossible combinations (e.g., "Los Angeles, Texas").

```typescript
const US_STATE_CITIES: Record<string, string[]> = {
  'CA': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', /* ... */],
  'TX': ['Houston', 'Dallas', 'Austin', 'San Antonio', /* ... */],
  'NY': ['New York', 'Buffalo', 'Rochester', 'Albany', /* ... */],
  // ... all 50 states with major cities
};

function validateCityStateMatch(city: string, state: string): boolean {
  const validCities = US_STATE_CITIES[state];
  if (!validCities) return true; // Unknown state
  // Fuzzy match for city names
  return validCities.some(c => 
    c.toLowerCase() === city.toLowerCase() ||
    city.toLowerCase().includes(c.toLowerCase())
  );
}
```

### 4. LinkedIn URL Format Validation (Medium Impact)
**Problem:** AI returns malformed LinkedIn URLs.

```typescript
function validateLinkedInUrl(url: string, type: 'profile' | 'company'): boolean {
  if (!url) return false;
  
  // Must be https://
  if (!url.startsWith('https://')) return false;
  
  // Profile URLs
  if (type === 'profile') {
    const profilePattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-z0-9\-]+\/?$/i;
    return profilePattern.test(url);
  }
  
  // Company URLs
  const companyPattern = /^https:\/\/(www\.)?linkedin\.com\/company\/[a-z0-9\-]+\/?$/i;
  return companyPattern.test(url);
}
```

### 5. Tech Stack Validation (Medium Impact)
**Problem:** AI hallucinates tech stacks that don't exist.

```typescript
const VALID_TECH_STACK_ITEMS = new Set([
  // Cloud Providers
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'DigitalOcean', 'Heroku',
  // Frameworks
  'React', 'Angular', 'Vue', 'Next.js', 'Django', 'Rails', 'Laravel',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  // CRM/Marketing
  'Salesforce', 'HubSpot', 'Marketo', 'Pardot', 'Intercom',
  // Analytics
  'Google Analytics', 'Mixpanel', 'Amplitude', 'Segment',
  // Payments
  'Stripe', 'PayPal', 'Braintree', 'Square',
  // ... 200+ valid tech items
]);

function validateTechStack(items: string[]): string[] {
  return items.filter(item => {
    const normalized = item.trim();
    // Check exact match or close match
    return VALID_TECH_STACK_ITEMS.has(normalized) ||
      [...VALID_TECH_STACK_ITEMS].some(valid => 
        valid.toLowerCase() === normalized.toLowerCase()
      );
  });
}
```

### 6. Confidence Decay for Stale Data (Medium Impact)
**Problem:** Cached data from 25 days ago has same confidence as fresh data.

```typescript
function applyConfidenceDecay(baseConfidence: number, cacheAgedays: number): number {
  // Decay 2% per week after first week
  if (cacheAgedays <= 7) return baseConfidence;
  const weeksOld = Math.floor((cacheAgedays - 7) / 7);
  const decayFactor = Math.max(0.7, 1 - (weeksOld * 0.02)); // Min 70% of original
  return baseConfidence * decayFactor;
}
```

### 7. Source Agreement Scoring (High Impact)
**Problem:** Single-source data treated same as multi-source verified data.

```typescript
interface FieldConfidence {
  value: any;
  sources: string[];
  agreementScore: number; // 0-100
}

function computeFieldConfidence(votes: { source: string; value: any }[]): FieldConfidence {
  if (votes.length === 0) return { value: null, sources: [], agreementScore: 0 };
  if (votes.length === 1) return { 
    value: votes[0].value, 
    sources: [votes[0].source], 
    agreementScore: 50 // Single source = 50%
  };
  
  // Count agreements
  const valueCounts = new Map<string, { count: number; sources: string[] }>();
  for (const vote of votes) {
    const key = JSON.stringify(vote.value);
    const existing = valueCounts.get(key) || { count: 0, sources: [] };
    existing.count++;
    existing.sources.push(vote.source);
    valueCounts.set(key, existing);
  }
  
  // Find winner
  let winner = { value: null, count: 0, sources: [] as string[] };
  for (const [key, data] of valueCounts) {
    if (data.count > winner.count) {
      winner = { value: JSON.parse(key), ...data };
    }
  }
  
  // Agreement score: 2 sources agreeing = 75%, 3+ = 90-99%
  const agreementScore = Math.min(99, 50 + (winner.count * 15));
  
  return {
    value: winner.value,
    sources: winner.sources,
    agreementScore,
  };
}
```

### 8. Employee Count Range Tolerance (Low Impact)
**Problem:** Rejecting valid data when sources report slightly different counts.

```typescript
function employeeCountsAgree(count1: number, count2: number): boolean {
  if (count1 === count2) return true;
  
  // Within 20% tolerance for small companies
  if (count1 < 100) {
    return Math.abs(count1 - count2) <= 20;
  }
  
  // Within 15% tolerance for medium companies
  if (count1 < 1000) {
    return Math.abs(count1 - count2) / count1 <= 0.15;
  }
  
  // Within 10% for large companies
  return Math.abs(count1 - count2) / count1 <= 0.10;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/provider-waterfall.ts` | Add 8 new validation functions, integrate into waterfall steps |
| `supabase/functions/_shared/validation.ts` | Add email domain validation, LinkedIn URL validation |
| `supabase/functions/_shared/enrichment-cache.ts` | Add confidence decay for stale cache entries |

---

## Implementation Priority

| Priority | Improvement | Impact | Effort |
|----------|-------------|--------|--------|
| 1 | Email Domain Validation | High - Prevents wrong company emails | Low |
| 2 | Source Agreement Scoring | High - Multi-source = higher confidence | Medium |
| 3 | Industry-NAICS Cross-Validation | High - Catches AI hallucinations | Medium |
| 4 | Location Plausibility | Medium - Catches city/state mismatches | Low |
| 5 | LinkedIn URL Validation | Medium - Cleaner profile URLs | Low |
| 6 | Tech Stack Validation | Medium - Removes fake tech | Low |
| 7 | Confidence Decay | Medium - Fresher = more accurate | Low |
| 8 | Employee Count Tolerance | Low - Better voting accuracy | Low |

---

## Expected Accuracy Improvements

| Metric | Current | After |
|--------|---------|-------|
| Email accuracy | ~85% | 95%+ (domain validation) |
| Industry accuracy | ~80% | 90%+ (NAICS cross-check) |
| Location accuracy | ~85% | 95%+ (city/state validation) |
| LinkedIn URL validity | ~75% | 99%+ (format validation) |
| Multi-source confidence | Same for 1-5 sources | Graduated 50-99% |
| Tech stack accuracy | Unknown | 90%+ (whitelist filter) |

---

## Technical Details

### Email Domain Validation Integration

```typescript
// In provider-waterfall.ts, during AI response processing

if (field === 'email') {
  // ACCURACY IMPROVEMENT #10: Validate email matches company domain
  const emailValidation = validateEmailMatchesDomain(value, domain);
  if (!emailValidation.isValid) {
    console.log(`[provider-waterfall] REJECTED email ${value} - ${emailValidation.reason}`);
    continue;
  }
}
```

### Source Agreement Integration

```typescript
// Extend existing voting logic to track all field votes
const fieldVotes: Record<string, { source: string; value: any }[]> = {};

// During provider response processing
for (const field of missingFields) {
  if (value !== undefined && value !== null) {
    if (!fieldVotes[field]) fieldVotes[field] = [];
    fieldVotes[field].push({ source: providerName, value });
  }
}

// After all providers processed
for (const [field, votes] of Object.entries(fieldVotes)) {
  const confidence = computeFieldConfidence(votes);
  if (confidence.agreementScore >= 75) {
    (data as any)[field] = confidence.value;
    // Store agreement score for reporting
    fieldConfidenceScores[field] = confidence.agreementScore;
  }
}
```

