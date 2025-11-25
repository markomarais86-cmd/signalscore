# Fit Score Calculation

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Data Science Team

## Overview

This document provides the detailed formulas and logic for calculating ICP Fit Scores in LaunchPulse. This is the technical implementation guide for the Statistical V2.0 scoring algorithm.

## Core Scoring Formula

```typescript
fitScore = Σ(dimensionScore_i × weight_i) × completenessAdjustment + correlationBoost
```

Where:
- `dimensionScore_i`: Score for dimension i (0-100)
- `weight_i`: Weight for dimension i (sum to 1.0)
- `completenessAdjustment`: Penalty for missing data (0.5 to 1.0)
- `correlationBoost`: Bonus from closed-won analysis (0 to +15)

## Dimension Calculations

### 1. Industry Score

```typescript
function calculateIndustryScore(
  accountIndustry: string,
  icpIndustries: string[]
): number {
  if (!accountIndustry || icpIndustries.length === 0) return 0;
  
  const normalizedAccount = normalizeIndustry(accountIndustry);
  const normalizedICP = icpIndustries.map(i => normalizeIndustry(i));
  
  // Exact match
  if (normalizedICP.includes(normalizedAccount)) {
    return 100;
  }
  
  // Category match (e.g., "Software" matches "SaaS Software")
  const category = getIndustryCategory(normalizedAccount);
  if (normalizedICP.some(icp => getIndustryCategory(icp) === category)) {
    return 70;
  }
  
  // Sub-industry match (e.g., "Cloud Computing" related to "SaaS")
  if (normalizedICP.some(icp => isRelatedIndustry(icp, normalizedAccount))) {
    return 50;
  }
  
  return 0;
}
```

**Industry Normalization**:
```typescript
function normalizeIndustry(industry: string): string {
  return industry
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[&\/]/g, ' ')
    .replace(/\s+/g, ' ');
}
```

**Industry Categories**:
- Technology: `Software, SaaS, Cloud, IT Services, Hardware`
- Finance: `Banking, FinTech, Insurance, Investment`
- Healthcare: `Healthcare, MedTech, Pharma, Biotech`
- Retail: `E-commerce, Retail, Consumer Goods`
- Manufacturing: `Manufacturing, Industrial, Automotive`

### 2. Geography Score

```typescript
function calculateGeographyScore(
  accountCountry: string,
  icpGeographies: string[]
): number {
  if (!accountCountry || icpGeographies.length === 0) return 0;
  
  const normalizedCountry = normalizeCountry(accountCountry);
  const normalizedICP = icpGeographies.map(g => normalizeCountry(g));
  
  // Exact country match
  if (normalizedICP.includes(normalizedCountry)) {
    return 100;
  }
  
  // Region match (e.g., "Germany" matches "Europe")
  const region = getRegion(normalizedCountry);
  if (normalizedICP.includes(region)) {
    return 80;
  }
  
  // Adjacent region (e.g., "Mexico" adjacent to "United States")
  if (normalizedICP.some(icp => isAdjacentRegion(icp, normalizedCountry))) {
    return 40;
  }
  
  return 0;
}
```

**Region Mapping**:
```typescript
const REGION_MAP = {
  'United States': 'North America',
  'Canada': 'North America',
  'Mexico': 'North America',
  'United Kingdom': 'Europe',
  'Germany': 'Europe',
  'France': 'Europe',
  // ... 195 countries mapped
};
```

### 3. Company Size Score

```typescript
function calculateCompanySizeScore(
  accountEmployeeCount: number,
  icpCompanySizes: number[]
): number {
  if (!accountEmployeeCount || icpCompanySizes.length === 0) return 0;
  
  const accountTier = getEmployeeTier(accountEmployeeCount);
  const icpTiers = icpCompanySizes.map(s => getEmployeeTier(s));
  
  // Within ICP range
  if (icpTiers.includes(accountTier)) {
    return 100;
  }
  
  // Adjacent tier (1 tier away)
  const tierDistance = Math.min(...icpTiers.map(t => Math.abs(t - accountTier)));
  if (tierDistance === 1) {
    return 60;
  }
  
  // Far from range (2+ tiers away)
  return Math.max(0, 20 - (tierDistance * 10));
}
```

**Employee Tiers**:
```typescript
function getEmployeeTier(employeeCount: number): number {
  if (employeeCount <= 10) return 1;
  if (employeeCount <= 50) return 2;
  if (employeeCount <= 200) return 3;
  if (employeeCount <= 1000) return 4;
  if (employeeCount <= 5000) return 5;
  return 6;
}
```

### 4. Revenue Score

```typescript
function calculateRevenueScore(
  accountRevenue: string,
  icpRevenueRanges: string[]
): number {
  if (!accountRevenue || icpRevenueRanges.length === 0) return 0;
  
  const accountTier = getRevenueTier(accountRevenue);
  const icpTiers = icpRevenueRanges.map(r => getRevenueTier(r));
  
  // Within ICP range
  if (icpTiers.includes(accountTier)) {
    return 100;
  }
  
  // Adjacent tier
  const tierDistance = Math.min(...icpTiers.map(t => Math.abs(t - accountTier)));
  if (tierDistance === 1) {
    return 60;
  }
  
  // Far from range
  return Math.max(0, 20 - (tierDistance * 10));
}
```

**Revenue Tiers**:
```typescript
function getRevenueTier(revenue: string): number {
  const amount = parseRevenue(revenue); // "$10M-50M" → 30 (midpoint)
  
  if (amount <= 1) return 1;        // $0-1M
  if (amount <= 10) return 2;       // $1M-10M
  if (amount <= 50) return 3;       // $10M-50M
  if (amount <= 100) return 4;      // $50M-100M
  if (amount <= 500) return 5;      // $100M-500M
  return 6;                         // $500M+
}
```

### 5. Technology Stack Score

```typescript
function calculateTechScore(
  accountTechStack: string[],
  icpTechStack: string[]
): number {
  if (!accountTechStack?.length || !icpTechStack?.length) return 0;
  
  const normalizedAccount = accountTechStack.map(t => t.toLowerCase());
  const normalizedICP = icpTechStack.map(t => t.toLowerCase());
  
  const matchCount = normalizedAccount.filter(tech =>
    normalizedICP.includes(tech)
  ).length;
  
  const overlapPercentage = matchCount / normalizedICP.length;
  
  return Math.round(overlapPercentage * 100);
}
```

**Critical Technologies**:
Some technologies are weighted higher (e.g., Salesforce = 2x weight):
```typescript
const CRITICAL_TECH = ['Salesforce', 'HubSpot', 'Microsoft Dynamics'];

function calculateWeightedTechScore(
  accountTechStack: string[],
  icpTechStack: string[]
): number {
  let totalWeight = 0;
  let matchedWeight = 0;
  
  icpTechStack.forEach(icpTech => {
    const weight = CRITICAL_TECH.includes(icpTech) ? 2 : 1;
    totalWeight += weight;
    
    if (accountTechStack.includes(icpTech)) {
      matchedWeight += weight;
    }
  });
  
  return (matchedWeight / totalWeight) * 100;
}
```

### 6. Funding Score

```typescript
function calculateFundingScore(
  account: Account,
  icpFundingStatus: string[]
): number {
  if (!account.last_funding_round || icpFundingStatus.length === 0) return 50;
  
  const fundingAge = daysSince(account.last_funding_date);
  
  // Recent funding (< 12 months)
  if (fundingAge < 365) {
    // Match growth stage
    if (icpFundingStatus.includes(account.last_funding_round)) {
      return 100;
    }
    return 80; // Recent funding, but wrong stage
  }
  
  // Older funding (12-36 months)
  if (fundingAge < 1095) {
    return 60;
  }
  
  // Old funding or bootstrapped
  return 40;
}
```

**Funding Stages**:
- Seed: Early-stage, pre-revenue
- Series A: Product-market fit, $2M-15M
- Series B: Scaling, $10M-50M
- Series C+: Growth, $25M+
- Bootstrapped: No external funding

## Completeness Adjustment

```typescript
function calculateCompleteness(account: Account): number {
  const requiredFields = [
    'industry_norm',
    'country',
    'employee_count',
    'revenue_range',
    'tech_stack'
  ];
  
  const filledFields = requiredFields.filter(field => {
    const value = account[field];
    return value && (Array.isArray(value) ? value.length > 0 : true);
  }).length;
  
  return filledFields / requiredFields.length;
}

function applyCompletenessAdjustment(
  baseScore: number,
  completeness: number
): number {
  // Minimum 50% of score even with low completeness
  const adjustment = 0.5 + (completeness * 0.5);
  return baseScore * adjustment;
}
```

**Example**:
- Base score: 90
- Completeness: 0.6 (3/5 fields)
- Adjustment: 0.5 + (0.6 × 0.5) = 0.8
- Final score: 90 × 0.8 = **72**

## Correlation Boost

If closed-won deal analysis is available:

```typescript
async function fetchCorrelations(
  icpId: string,
  orgId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('icp_feature_weights')
    .select('feature_name, weight, r_value, p_value, is_significant')
    .eq('icp_id', icpId)
    .eq('org_id', orgId)
    .eq('is_significant', true);
  
  const correlations: Record<string, number> = {};
  data?.forEach(row => {
    if (row.r_value > 0.5 && row.p_value < 0.05) {
      correlations[row.feature_name] = row.weight;
    }
  });
  
  return correlations;
}

function applyCorrelationBoost(
  baseScore: number,
  correlations: Record<string, number>,
  account: Account
): number {
  let boost = 0;
  
  // Industry boost
  if (correlations['industry'] && account.industry_norm) {
    boost += correlations['industry'] * 10; // Up to +10 points
  }
  
  // Geography boost
  if (correlations['geography'] && account.country) {
    boost += correlations['geography'] * 8; // Up to +8 points
  }
  
  // Size boost
  if (correlations['company_size'] && account.employee_count) {
    boost += correlations['company_size'] * 7; // Up to +7 points
  }
  
  return Math.min(baseScore + boost, 100); // Cap at 100
}
```

## Complete Algorithm Implementation

```typescript
export async function calculateFitScore(
  accountId: string,
  icpId: string,
  orgId: string
): Promise<ScoreResult> {
  // 1. Fetch account and ICP data
  const account = await fetchAccount(accountId, orgId);
  const icp = await fetchICP(icpId, orgId);
  
  // 2. Calculate dimension scores
  const industryScore = calculateIndustryScore(account.industry_norm, icp.industries);
  const geographyScore = calculateGeographyScore(account.country, icp.geographies);
  const sizeScore = calculateCompanySizeScore(account.employee_count, icp.company_sizes);
  const revenueScore = calculateRevenueScore(account.revenue_range, icp.revenue_ranges);
  const techScore = calculateTechScore(account.tech_stack, icp.tech_stack);
  const fundingScore = calculateFundingScore(account, icp.funding_status);
  
  // 3. Apply weights
  const baseScore = 
    (industryScore * 0.25) +
    (geographyScore * 0.20) +
    (sizeScore * 0.20) +
    (revenueScore * 0.15) +
    (techScore * 0.10) +
    (fundingScore * 0.10);
  
  // 4. Calculate completeness
  const completeness = calculateCompleteness(account);
  
  // 5. Apply completeness adjustment
  const adjustedScore = applyCompletenessAdjustment(baseScore, completeness);
  
  // 6. Fetch correlations
  const correlations = await fetchCorrelations(icpId, orgId);
  
  // 7. Apply correlation boost
  const finalScore = applyCorrelationBoost(adjustedScore, correlations, account);
  
  // 8. Assign band
  const band = 
    finalScore >= 80 ? 'A' :
    finalScore >= 60 ? 'B' :
    finalScore >= 40 ? 'C' : 'D';
  
  return {
    score: Math.round(finalScore),
    band,
    breakdown: {
      industry: Math.round(industryScore * 0.25),
      geography: Math.round(geographyScore * 0.20),
      company_size: Math.round(sizeScore * 0.20),
      revenue: Math.round(revenueScore * 0.15),
      tech_stack: Math.round(techScore * 0.10),
      funding: Math.round(fundingScore * 0.10)
    },
    completeness,
    computed_at: new Date().toISOString()
  };
}
```

## Testing & Validation

### Unit Tests

```typescript
describe('Fit Score Calculation', () => {
  it('calculates perfect match correctly', () => {
    const account = {
      industry_norm: 'SaaS',
      country: 'United States',
      employee_count: 500,
      revenue_range: '$10M-50M',
      tech_stack: ['Salesforce', 'HubSpot'],
    };
    
    const icp = {
      industries: ['SaaS'],
      geographies: ['United States'],
      company_sizes: [500],
      revenue_ranges: ['$10M-50M'],
      tech_stack: ['Salesforce', 'HubSpot'],
    };
    
    const result = calculateFitScore(account, icp);
    expect(result.score).toBeGreaterThan(95);
    expect(result.band).toBe('A');
  });
  
  it('applies completeness penalty correctly', () => {
    const account = {
      industry_norm: 'SaaS',
      country: 'United States',
      // Missing: employee_count, revenue_range, tech_stack
    };
    
    const result = calculateFitScore(account, icp);
    expect(result.completeness).toBe(0.4); // 2/5 fields
    expect(result.score).toBeLessThan(50); // Penalty applied
  });
});
```

## Related Documentation

- [Scoring Overview](./Scoring_Overview.md) - User-facing scoring guide
- [Scoring Engine Architecture](../00_Architecture/Scoring_Engine_Architecture.md) - System architecture
- [Closed-Won Analysis](./Closed_Won_Analysis.md) - Correlation boosting

## Support

For technical questions:
- **Data Science Team**: datascience@launchpulse.ai
- **GitHub**: [launchpulse/scoring-engine](https://github.com/launchpulse/scoring-engine)
