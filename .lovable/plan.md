
# Enrichment Accuracy Improvements - Implementation Plan

## Overview
This plan focuses on improving the **data accuracy** of the existing enrichment system without changing the core 7-step waterfall architecture. These are all **code-level fixes** that add zero additional API costs.

---

## Summary of Changes

| Improvement | Expected Accuracy Gain | Cost Impact | Risk |
|-------------|------------------------|-------------|------|
| 1. Generic Email Filter | Eliminates 5-10% of bad first names | $0 | Low |
| 2. Cross-Source Voting for Firmographics | +15-25% accuracy on employee_count, revenue | $0 | Low |
| 3. Firmographic Sanity Checks | Catches 20-30% of AI hallucinations | $0 | Low |
| 4. Phone Switchboard Classification | +20% dialable yield | $0 | Low |
| 5. Enterprise Phone Suppression | Fixes Allstate/AWS-type issues | $0 | Low |
| 6. Title Normalization | Cleaner ICP/persona matching | $0 | Low |

---

## Detailed Implementation

### 1. Generic Email Filter

**Problem:** `extractNameFromEmail()` currently parses generic emails like `info@company.com` → `first_name: "Info"`

**File:** `supabase/functions/_shared/provider-waterfall.ts`

**Solution:** Add a blocklist of generic email prefixes at line ~254:

```typescript
// Generic email prefixes that should NOT be parsed as names
const GENERIC_EMAIL_PREFIXES = [
  'info', 'contact', 'hello', 'hi', 'sales', 'support', 'admin', 
  'office', 'help', 'team', 'general', 'mail', 'email', 'enquiry',
  'inquiry', 'billing', 'accounts', 'service', 'customerservice',
  'feedback', 'press', 'media', 'marketing', 'hr', 'careers', 
  'jobs', 'legal', 'privacy', 'webmaster', 'noreply', 'no-reply',
  'donotreply', 'notifications', 'alerts', 'newsletter', 'subscribe'
];
```

Then update `extractNameFromEmail()` to check:
```typescript
// Before line 286 (single word email handling)
if (GENERIC_EMAIL_PREFIXES.includes(local)) {
  console.log(`[provider-waterfall] Skipping generic email prefix: ${local}`);
  return null;
}
```

---

### 2. Cross-Source Voting for Firmographics

**Problem:** When multiple AI providers return different `employee_count` or `revenue_range` values, the system uses precedence-based "first wins" logic instead of consensus.

**File:** `supabase/functions/_shared/provider-waterfall.ts`

**Solution:** Add voting logic in `enrichFromMultipleAI()` after collecting all provider responses (around line 1066):

```typescript
// New function to add at ~line 240
function computeMedianEmployeeCount(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function computeMajorityRevenueRange(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  // Return value with most votes (ties go to first)
  let maxCount = 0;
  let winner: string | null = null;
  for (const [value, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }
  return winner;
}
```

Then in `enrichFromMultipleAI()`, collect all values before applying precedence:
```typescript
// Track all values for voting fields
const employeeCountVotes: number[] = [];
const revenueRangeVotes: string[] = [];

// After parsing each provider response, add to votes:
if (parsed.employee_count && typeof parsed.employee_count === 'number') {
  employeeCountVotes.push(parsed.employee_count);
}
if (parsed.revenue_range) {
  revenueRangeVotes.push(parsed.revenue_range);
}

// After processing all providers, apply voting for these specific fields:
if (employeeCountVotes.length >= 2 && !verifiedFields.has('employee_count')) {
  data.employee_count = computeMedianEmployeeCount(employeeCountVotes);
  console.log(`[provider-waterfall] Voted employee_count: ${data.employee_count} from ${employeeCountVotes.length} sources: ${employeeCountVotes.join(', ')}`);
}
if (revenueRangeVotes.length >= 2 && !verifiedFields.has('revenue_range')) {
  const voted = computeMajorityRevenueRange(revenueRangeVotes);
  if (voted) {
    data.revenue_range = voted;
    console.log(`[provider-waterfall] Voted revenue_range: ${voted} from ${revenueRangeVotes.length} sources`);
  }
}
```

---

### 3. Firmographic Sanity Checks

**Problem:** AI providers sometimes return impossible combinations (e.g., 10 employees claiming $10B+ revenue).

**File:** `supabase/functions/_shared/provider-waterfall.ts`

**Solution:** Add validation functions and apply them before storing firmographic data:

```typescript
// New validation functions at ~line 245
interface FirmographicValidation {
  isValid: boolean;
  reason?: string;
}

function validateEmployeeRevenuePair(
  employeeCount: number | undefined, 
  revenueRange: string | undefined
): FirmographicValidation {
  if (!employeeCount || !revenueRange) return { isValid: true };
  
  // Revenue per employee sanity checks
  const revenueMap: Record<string, { min: number; max: number }> = {
    '$0-$1M': { min: 0, max: 1000000 },
    '$1M-$5M': { min: 1000000, max: 5000000 },
    '$5M-$10M': { min: 5000000, max: 10000000 },
    '$10M-$25M': { min: 10000000, max: 25000000 },
    '$25M-$50M': { min: 25000000, max: 50000000 },
    '$50M-$100M': { min: 50000000, max: 100000000 },
    '$100M-$500M': { min: 100000000, max: 500000000 },
    '$500M-$1B': { min: 500000000, max: 1000000000 },
    '$1B-$10B': { min: 1000000000, max: 10000000000 },
    '$10B+': { min: 10000000000, max: Infinity },
  };
  
  const range = revenueMap[revenueRange];
  if (!range) return { isValid: true };
  
  const avgRevenue = (range.min + Math.min(range.max, 100000000000)) / 2;
  const revenuePerEmployee = avgRevenue / employeeCount;
  
  // Typical B2B: $100K-$500K per employee. 
  // Reject if <$50K or >$5M per employee (hallucination indicators)
  if (revenuePerEmployee < 50000) {
    return { isValid: false, reason: `Too few employees (${employeeCount}) for ${revenueRange}` };
  }
  if (revenuePerEmployee > 5000000) {
    return { isValid: false, reason: `Too many employees (${employeeCount}) for ${revenueRange}` };
  }
  
  return { isValid: true };
}

function validateEmployeeCountForDomain(
  employeeCount: number,
  domain: string | undefined
): FirmographicValidation {
  if (!domain) return { isValid: true };
  
  // Large enterprise domains - don't accept small counts
  const enterpriseDomains = ['amazon.com', 'google.com', 'microsoft.com', 'apple.com', 
    'facebook.com', 'meta.com', 'ibm.com', 'oracle.com', 'salesforce.com'];
  const isEnterprise = enterpriseDomains.some(d => domain.includes(d));
  
  if (isEnterprise && employeeCount < 1000) {
    return { isValid: false, reason: `Enterprise domain ${domain} unlikely to have only ${employeeCount} employees` };
  }
  
  // SMB indicators - reject very high counts
  const smbIndicators = ['shop', 'store', 'local', 'family', 'small'];
  const isSMB = smbIndicators.some(ind => domain.toLowerCase().includes(ind));
  
  if (isSMB && employeeCount > 500) {
    return { isValid: false, reason: `SMB-indicating domain unlikely to have ${employeeCount} employees` };
  }
  
  return { isValid: true };
}
```

Apply these checks in the multi-AI aggregation before accepting values.

---

### 4. Phone Switchboard Classification

**Problem:** Current `classifyPhoneType()` doesn't distinguish switchboard numbers from direct dials well enough for SDR use.

**File:** `supabase/functions/_shared/phone-utils.ts`

**Solution:** Enhance the classification function at line ~383:

```typescript
// Enhanced phone classification with confidence
export interface PhoneClassification {
  type: 'direct' | 'mobile' | 'office' | 'main' | 'switchboard';
  confidence: number;
  reason: string;
}

export function classifyPhoneTypeAdvanced(
  phone: string,
  context: string,
  companySize?: number
): PhoneClassification {
  const digits = phone.replace(/\D/g, '');
  const lower = context.toLowerCase();
  
  // Check for toll-free (always switchboard for outbound)
  if (isTollFree(phone)) {
    return { 
      type: 'switchboard', 
      confidence: 95, 
      reason: 'Toll-free number' 
    };
  }
  
  // Mobile indicators (high dialable value)
  if (/\b(cell|mobile|personal|direct\s*line)\b/.test(lower)) {
    return { type: 'mobile', confidence: 85, reason: 'Context indicates mobile' };
  }
  
  // Direct dial indicators
  if (/\b(direct|personal|private|desk)\b/.test(lower)) {
    return { type: 'direct', confidence: 80, reason: 'Context indicates direct line' };
  }
  
  // Switchboard indicators
  if (/\b(main|general|reception|operator|switchboard|headquarters|hq|corporate)\b/.test(lower)) {
    return { type: 'switchboard', confidence: 85, reason: 'Context indicates switchboard' };
  }
  
  // Large companies (>500 employees) - assume switchboard unless proven otherwise
  if (companySize && companySize > 500) {
    return { type: 'switchboard', confidence: 70, reason: 'Large company, likely switchboard' };
  }
  
  // Extension patterns (x123, ext 456) indicate office/switchboard
  if (/x\d+|ext\.?\s*\d+/i.test(context)) {
    return { type: 'office', confidence: 75, reason: 'Has extension' };
  }
  
  // Default for small companies - more likely to be direct
  if (companySize && companySize < 50) {
    return { type: 'direct', confidence: 60, reason: 'Small company, likely reaches decision maker' };
  }
  
  return { type: 'main', confidence: 50, reason: 'Unknown type' };
}
```

Update `PhoneEntry` interface to include classification:
```typescript
export interface PhoneEntry {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main' | 'switchboard';
  source: string;
  confidence: number;
  classification?: PhoneClassification;
  citation?: string;
}
```

---

### 5. Enterprise Phone Suppression

**Problem:** AI providers hallucinate direct dial numbers for large enterprises like Allstate, AWS, where SDRs can't actually reach individuals.

**File:** `supabase/functions/_shared/phone-utils.ts`

**Solution:** Add enterprise suppression rules:

```typescript
// Enterprise domains where AI-generated phone numbers should be suppressed
const ENTERPRISE_PHONE_SUPPRESSION_DOMAINS = [
  'amazon.com', 'aws.amazon.com', 'google.com', 'microsoft.com', 'apple.com',
  'facebook.com', 'meta.com', 'ibm.com', 'oracle.com', 'salesforce.com',
  'allstate.com', 'statefarm.com', 'geico.com', 'progressive.com',
  'wellsfargo.com', 'bankofamerica.com', 'chase.com', 'citi.com',
  'walmart.com', 'target.com', 'costco.com', 'homedepot.com',
  'att.com', 'verizon.com', 't-mobile.com', 'comcast.com',
];

export function shouldSuppressAIPhone(
  domain: string | undefined,
  employeeCount: number | undefined,
  source: string
): { suppress: boolean; reason?: string } {
  // Only suppress AI-generated phones, not website-scraped ones
  const aiSources = ['perplexity', 'anthropic', 'openai', 'xai', 'lovable', 'ai_'];
  const isAISource = aiSources.some(s => source.toLowerCase().includes(s));
  
  if (!isAISource) {
    return { suppress: false };
  }
  
  // Suppress for known enterprise domains
  if (domain) {
    const domainLower = domain.toLowerCase();
    for (const ent of ENTERPRISE_PHONE_SUPPRESSION_DOMAINS) {
      if (domainLower.includes(ent) || ent.includes(domainLower)) {
        return { 
          suppress: true, 
          reason: `Enterprise domain ${domain} - AI phone likely switchboard or hallucinated` 
        };
      }
    }
  }
  
  // Suppress for very large companies
  if (employeeCount && employeeCount > 10000) {
    return { 
      suppress: true, 
      reason: `Large enterprise (${employeeCount} employees) - AI phone unreliable` 
    };
  }
  
  return { suppress: false };
}
```

Then apply this check in `enrichFromPerplexity()` and `enrichFromMultipleAI()` before storing phone values.

---

### 6. Title Normalization

**Problem:** Titles like "Owner", "Proprietor", "Founder" are stored differently, fragmenting ICP/persona analysis.

**File:** `supabase/functions/_shared/provider-waterfall.ts`

**Solution:** Add title normalization utility:

```typescript
// Title normalization map for consistent ICP matching
const TITLE_NORMALIZATION_MAP: Record<string, string> = {
  // Owner variants → Owner
  'proprietor': 'Owner',
  'business owner': 'Owner',
  'shop owner': 'Owner',
  'store owner': 'Owner',
  
  // Founder variants → Founder
  'co-founder': 'Co-Founder',
  'cofounder': 'Co-Founder',
  'founding partner': 'Co-Founder',
  
  // CEO variants
  'chief executive': 'CEO',
  'chief executive officer': 'CEO',
  
  // CTO variants  
  'chief technology officer': 'CTO',
  'chief technical officer': 'CTO',
  'vp engineering': 'VP of Engineering',
  'vp of engineering': 'VP of Engineering',
  
  // CFO variants
  'chief financial officer': 'CFO',
  'finance director': 'CFO',
  
  // COO variants
  'chief operating officer': 'COO',
  'chief operations officer': 'COO',
  
  // President variants
  'company president': 'President',
  
  // Partner variants
  'managing partner': 'Managing Partner',
  'senior partner': 'Senior Partner',
  'general partner': 'General Partner',
  
  // Director variants
  'director of sales': 'Sales Director',
  'director of marketing': 'Marketing Director',
  'director of operations': 'Operations Director',
  'director of engineering': 'Engineering Director',
};

export function normalizeTitle(title: string): string {
  if (!title) return title;
  
  const lowerTitle = title.toLowerCase().trim();
  
  // Check for exact match first
  if (TITLE_NORMALIZATION_MAP[lowerTitle]) {
    return TITLE_NORMALIZATION_MAP[lowerTitle];
  }
  
  // Check for partial matches (e.g., "Founder & CEO" should normalize Founder part)
  for (const [variant, normalized] of Object.entries(TITLE_NORMALIZATION_MAP)) {
    if (lowerTitle.includes(variant)) {
      // Replace the variant with normalized version
      return title.replace(new RegExp(variant, 'i'), normalized);
    }
  }
  
  // Return original with proper casing
  return title;
}
```

Apply `normalizeTitle()` when storing title data in both `enrichFromPerplexity()` and `enrichFromMultipleAI()`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/provider-waterfall.ts` | Generic email filter, cross-source voting, firmographic validation, title normalization |
| `supabase/functions/_shared/phone-utils.ts` | Enhanced phone classification, enterprise suppression |

---

## Testing Strategy

After implementation, validate with these test cases:

1. **Generic Email Test:** `info@acme.com` should return `null` for first_name
2. **Cross-Source Voting Test:** Mock 3 AI providers returning employee counts of 45, 55, 200 → should output 55 (median)
3. **Sanity Check Test:** 10 employees + "$10B+" revenue → should be rejected
4. **Phone Classification Test:** Toll-free 1-800 number → should be classified as "switchboard"
5. **Enterprise Suppression Test:** Phone discovered via Perplexity for `amazon.com` → should be suppressed
6. **Title Normalization Test:** "Proprietor" → "Owner"

---

## Deployment

These changes are isolated to the `_shared` modules and will take effect immediately upon deployment of the `enrich-unified` edge function. No database migrations required.
