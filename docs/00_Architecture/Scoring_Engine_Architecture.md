# Scoring Engine Architecture

**Version:** 2.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Data Science Team

## Overview

The LaunchPulse Scoring Engine is a multi-dimensional statistical scoring system that evaluates accounts against Ideal Customer Profile (ICP) definitions. It produces a 0-100 ICP fit score plus an A/B/C band classification.

**Version 2.0** (Statistical Algorithm) replaced the previous rule-based system with a weighted, correlation-driven model that learns from closed-won deals.

## Scoring Dimensions

### 1. Industry Match (Weight: 25%)
- **Perfect Match**: Exact industry match → 100 points
- **Category Match**: Same high-level category → 70 points
- **Sub-Industry Match**: Related sub-industry → 50 points
- **No Match**: Industry not in ICP → 0 points

**Example**:
- ICP: `["Software", "SaaS", "Cloud Computing"]`
- Account Industry: `"SaaS"` → 100 points × 0.25 = **25 points**

### 2. Geography Match (Weight: 20%)
- **Country Match**: Account in target country → 100 points
- **Region Match**: Account in target region → 80 points
- **Adjacent Region**: Nearby region → 40 points
- **No Match**: Not in target geography → 0 points

**Example**:
- ICP: `["United States", "Canada", "United Kingdom"]`
- Account Country: `"United States"` → 100 points × 0.20 = **20 points**

### 3. Company Size Match (Weight: 20%)
- **Within Range**: Employee count in ICP range → 100 points
- **Adjacent Range**: 1 tier above/below → 60 points
- **Far from Range**: 2+ tiers away → 20 points

**Size Tiers**:
- Tier 1: 1-10 employees
- Tier 2: 11-50 employees
- Tier 3: 51-200 employees
- Tier 4: 201-1000 employees
- Tier 5: 1000-5000 employees
- Tier 6: 5000+ employees

**Example**:
- ICP: `[201-1000]` (Tier 4)
- Account Employees: `350` → 100 points × 0.20 = **20 points**

### 4. Revenue Match (Weight: 15%)
- **Within Range**: Revenue in ICP range → 100 points
- **Adjacent Range**: 1 tier above/below → 60 points
- **Far from Range**: 2+ tiers away → 20 points

**Revenue Tiers**:
- Tier 1: $0-1M
- Tier 2: $1M-10M
- Tier 3: $10M-50M
- Tier 4: $50M-100M
- Tier 5: $100M-500M
- Tier 6: $500M+

**Example**:
- ICP: `["$10M-50M", "$50M-100M"]`
- Account Revenue: `"$25M"` → 100 points × 0.15 = **15 points**

### 5. Technology Match (Weight: 10%)
- **Tech Stack Overlap**: Percentage of ICP technologies present
- **Critical Tech**: Required technologies (e.g., Salesforce) = higher weight
- **Nice-to-Have Tech**: Optional technologies = lower weight

**Example**:
- ICP Tech: `["Salesforce", "HubSpot", "AWS"]`
- Account Tech: `["Salesforce", "AWS", "Google Cloud"]`
- Overlap: 2/3 = 66.67% → 66.67 points × 0.10 = **6.67 points**

### 6. Funding/Growth Signals (Weight: 10%)
- **Recent Funding**: Funding in last 12 months → 100 points
- **Growth Stage**: Series A-C = 80, Series D+ = 60, Bootstrapped = 40
- **Total Raised**: High total raised = growth signal

**Example**:
- Account: Series B, $15M raised 6 months ago → 100 points × 0.10 = **10 points**

## Scoring Algorithm (V2.0 - Statistical)

### Step 1: Base Score Calculation

```typescript
baseScore = 
  (industryScore × 0.25) +
  (geographyScore × 0.20) +
  (companySizeScore × 0.20) +
  (revenueScore × 0.15) +
  (techStackScore × 0.10) +
  (fundingScore × 0.10)
```

### Step 2: Data Quality Adjustment

Incomplete data reduces confidence in the score:

```typescript
completenessScore = (
  (hasIndustry ? 1 : 0) +
  (hasGeography ? 1 : 0) +
  (hasEmployeeCount ? 1 : 0) +
  (hasRevenue ? 1 : 0) +
  (hasTechStack ? 1 : 0)
) / 5

adjustedScore = baseScore × (0.5 + (completenessScore × 0.5))
```

**Minimum data requirement**: 3/5 fields required for scoring.

### Step 3: Closed-Won Boosting (Correlation Analysis)

If the organization has closed-won deal data, we analyze correlations:

```sql
SELECT 
  feature_name,
  weight,
  r_value,
  p_value,
  is_significant
FROM icp_feature_weights
WHERE icp_id = $1 AND is_significant = true
ORDER BY weight DESC;
```

**Boosting Formula**:
```typescript
finalScore = adjustedScore + (
  (industryCorrelation × industryBoost) +
  (geographyCorrelation × geographyBoost) +
  (sizeCorrelation × sizeBoost)
)
```

Where:
- `industryCorrelation`: Pearson r-value from closed-won analysis
- `industryBoost`: +10 points if r > 0.5 and p < 0.05

### Step 4: Score Banding

Final scores are mapped to A/B/C bands:

| Band | Score Range | Interpretation |
|------|-------------|----------------|
| A | 80-100 | Perfect fit, high priority |
| B | 60-79 | Good fit, qualified |
| C | 40-59 | Potential fit, needs nurturing |
| D | 0-39 | Poor fit, low priority |

## Edge Function: `score-account`

### Input
```typescript
{
  "account_external_id": "string",
  "icp_id": "uuid",
  "org_id": "uuid"
}
```

### Processing Steps

1. **Fetch Account Data**:
```sql
SELECT 
  external_id, name, domain, industry_norm,
  country, employee_count, revenue_range,
  tech_stack, total_raised_usd, last_funding_round
FROM accounts
WHERE external_id = $1 AND org_id = $2;
```

2. **Fetch ICP Profile**:
```sql
SELECT 
  industries, geographies, company_sizes, revenue_ranges,
  tech_stack, funding_status
FROM icp_profiles
WHERE id = $1 AND org_id = $2;
```

3. **Calculate Dimension Scores**:
```typescript
const industryScore = calculateIndustryMatch(account.industry_norm, icp.industries);
const geographyScore = calculateGeographyMatch(account.country, icp.geographies);
const sizeScore = calculateSizeMatch(account.employee_count, icp.company_sizes);
const revenueScore = calculateRevenueMatch(account.revenue_range, icp.revenue_ranges);
const techScore = calculateTechMatch(account.tech_stack, icp.tech_stack);
const fundingScore = calculateFundingMatch(account, icp.funding_status);
```

4. **Apply Weights and Adjustments**:
```typescript
const baseScore = (industryScore * 0.25) + (geographyScore * 0.20) + ...;
const completeness = calculateCompleteness(account);
const adjustedScore = baseScore * (0.5 + (completeness * 0.5));
```

5. **Fetch Correlations** (if available):
```sql
SELECT feature_name, weight 
FROM icp_feature_weights
WHERE icp_id = $1 AND is_significant = true;
```

6. **Apply Boosting**:
```typescript
const finalScore = applyCorrelationBoost(adjustedScore, correlations, account);
```

7. **Assign Band**:
```typescript
const band = 
  finalScore >= 80 ? 'A' :
  finalScore >= 60 ? 'B' :
  finalScore >= 40 ? 'C' : 'D';
```

8. **Store Result**:
```sql
INSERT INTO scores (account_external_id, icp_id, org_id, propensity_score, band, computed_at)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (account_external_id, icp_id, org_id)
DO UPDATE SET 
  propensity_score = $4,
  band = $5,
  computed_at = NOW();
```

### Output
```typescript
{
  "success": true,
  "score": 87,
  "band": "A",
  "breakdown": {
    "industry": 25,
    "geography": 20,
    "size": 18,
    "revenue": 12,
    "tech_stack": 7,
    "funding": 5
  },
  "completeness": 0.95,
  "computed_at": "2025-11-25T10:30:00Z"
}
```

## Bulk Scoring

For scoring large datasets, use `bulk-score-accounts`:

### Processing Strategy

1. **Job Creation**:
```sql
INSERT INTO bulk_scoring_jobs (org_id, icp_id, total_accounts, status)
VALUES ($1, $2, $3, 'pending')
RETURNING id;
```

2. **Chunked Processing**:
- Fetch accounts in chunks of 100
- Score each chunk via `score-account` edge function
- Update job progress after each chunk
- Handle errors with retry logic (3 attempts)

3. **Progress Tracking**:
```typescript
{
  "job_id": "uuid",
  "status": "processing",
  "progress": 0.65,
  "processed": 650,
  "total": 1000,
  "successful_scores": 645,
  "failed_scores": 5,
  "estimated_completion": "2025-11-25T11:15:00Z"
}
```

4. **Error Handling**:
- Failed scores logged to `failed_scores` table
- Automatic retry with exponential backoff
- Manual retry available after job completion

## Propensity Scoring (ML-based)

**Status**: Feature available, requires training data

### Training Process

1. **Data Collection**:
```sql
SELECT a.*, s.propensity_score, cw.close_date, cw.deal_value
FROM accounts a
JOIN scores s ON a.external_id = s.account_external_id
LEFT JOIN closed_won_deals cw ON a.external_id = cw.account_external_id
WHERE a.org_id = $1;
```

2. **Feature Engineering**:
- ICP fit score (from statistical model)
- Account age
- Engagement signals (page views, downloads)
- Enrichment confidence
- Industry trends

3. **Model Training**:
- Algorithm: Gradient Boosted Trees (XGBoost)
- Target: Binary (closed-won vs not)
- Validation: 80/20 train-test split
- Metrics: AUC-ROC, precision@k

4. **Score Generation**:
```typescript
propensityScore = model.predict(accountFeatures);
// Output: 0.0 - 1.0 probability of conversion
```

5. **Storage**:
```sql
UPDATE accounts
SET propensity_score = $1, propensity_computed_at = NOW()
WHERE external_id = $2 AND org_id = $3;
```

## Performance Metrics

### Current Performance (Nov 2025)
- **Total Accounts**: 12,413
- **Scored Accounts**: 11,618 (93.6%)
- **Score Distribution**:
  - A Band (80-100): 1,837 accounts (15.8%)
  - B Band (60-79): 4,521 accounts (38.9%)
  - C Band (40-59): 3,890 accounts (33.5%)
  - D Band (0-39): 1,370 accounts (11.8%)

### Scoring Speed
- **Single Account**: <200ms
- **Bulk Scoring (100 accounts)**: ~15 seconds
- **Bulk Scoring (10,000 accounts)**: ~25 minutes

### Data Quality Impact
- **5/5 Fields Complete**: 100% score confidence
- **4/5 Fields Complete**: 90% score confidence
- **3/5 Fields Complete**: 75% score confidence (minimum)
- **<3/5 Fields**: Scoring disabled (insufficient data)

## Related Documentation

- [Scoring Overview](../08_Scoring_Engine/Scoring_Overview.md) - User-facing scoring guide
- [ICP Manager Guide](../01_User_Guides/ICP_Manager_Guide.md) - Creating ICPs
- [Closed-Won Analysis](../08_Scoring_Engine/Closed_Won_Analysis.md) - Training from wins
- [Data Model Schema](./Data_Model_Schema.md) - Scores table schema

## Support

For scoring engine questions:
- **Data Science Team**: datascience@launchpulse.ai
- **Slack**: #launchpulse-scoring
