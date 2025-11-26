# Scoring Insights Guide

## Overview

LaunchPulse's scoring system provides quantitative fit assessments for every account in your database. This guide explains how to interpret scores, understand breakdowns, analyze trends, and use scoring insights to prioritize your sales and marketing efforts.

## Table of Contents

1. [Understanding Fit Scores](#understanding-fit-scores)
2. [Score Breakdown by Dimension](#score-breakdown-by-dimension)
3. [Score Band Interpretation](#score-band-interpretation)
4. [Score History and Trends](#score-history-and-trends)
5. [Using Scores for Prioritization](#using-scores-for-prioritization)
6. [Score Comparison Across ICPs](#score-comparison-across-icps)
7. [Propensity Scoring](#propensity-scoring)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Understanding Fit Scores

### What is a Fit Score?

A **fit score** is a numerical assessment (0-100) indicating how well an account matches your Ideal Customer Profile (ICP). Scores are calculated using LaunchPulse's Statistical V2 scoring engine, which weighs multiple dimensions based on historical closed-won patterns.

### Score Components

```
Overall Fit Score (0-100)
├── Firmographic Score (weighted)
│   ├── Company Size
│   ├── Industry Match
│   ├── Geographic Fit
│   └── Revenue Range
├── Behavioral Score (weighted)
│   ├── Intent Signals
│   ├── Technology Stack
│   └── Engagement History
└── Context Score (weighted)
    ├── Funding Status
    ├── Growth Stage
    └── Buying Triggers
```

### Score Calculation Method

LaunchPulse uses **weighted dimensional scoring**:

1. **Dimensional Scores**: Each dimension (size, industry, geography) receives a 0-100 score
2. **Statistical Weights**: Weights derived from closed-won analysis (correlation strength)
3. **Weighted Average**: Overall score = sum of (dimension_score × dimension_weight)

**Example Calculation:**
```
Company Size Score: 85 (weight: 0.30) = 25.5
Industry Score: 90 (weight: 0.25) = 22.5
Geography Score: 75 (weight: 0.20) = 15.0
Revenue Score: 80 (weight: 0.15) = 12.0
Tech Stack Score: 70 (weight: 0.10) = 7.0

Overall Fit Score = 82.0
```

### What Scores Mean

| Score Range | Interpretation | Conversion Likelihood |
|-------------|----------------|----------------------|
| **90-100** | Perfect fit | Very High (>30%) |
| **80-89** | Excellent fit | High (20-30%) |
| **70-79** | Strong fit | Medium-High (15-20%) |
| **60-69** | Good fit | Medium (10-15%) |
| **50-59** | Moderate fit | Low-Medium (5-10%) |
| **40-49** | Weak fit | Low (<5%) |
| **0-39** | Poor fit | Very Low (<2%) |

---

## Score Breakdown by Dimension

### Accessing Score Breakdown

View detailed score breakdowns:
1. Navigate to the **Accounts** page
2. Click on any account to open the detail drawer
3. Select the **"Scoring"** tab
4. View dimension-by-dimension breakdown

### Dimension Details

#### 1. Company Size Score

**What it measures:** How well the company's employee count matches your ICP's target size ranges.

**Scoring Logic:**
- **100**: Exact match to target size
- **80-99**: Within preferred size range
- **50-79**: Adjacent size range
- **0-49**: Outside target size ranges

**Example:**
```
ICP Target: 200-1,000 employees
Account Size: 450 employees
Size Score: 95 (within range)
```

**Insights:**
- **High Score (80+)**: Right-sized account for your solution
- **Low Score (<50)**: May be too small/large for your offering

#### 2. Industry Score

**What it measures:** Alignment between account industry and ICP target industries.

**Scoring Logic:**
- **100**: Exact industry match
- **80-99**: Sub-industry match
- **50-79**: Related industry
- **0-49**: Different industry

**Example:**
```
ICP Target: Financial Services → Banking
Account Industry: Financial Services → Investment Management
Industry Score: 85 (sub-industry match)
```

**Insights:**
- **High Score (90+)**: Strong product-market fit
- **Medium Score (60-89)**: Adjacent market, may need customization
- **Low Score (<60)**: Requires significant adaptation

#### 3. Geography Score

**What it measures:** Geographic alignment with ICP target markets.

**Scoring Logic:**
- **100**: Exact country + region match
- **80-99**: Country match, different region
- **50-79**: Different country, same continent
- **0-49**: Different continent

**Example:**
```
ICP Target: United States, California
Account Location: United States, Texas
Geography Score: 88 (same country)
```

**Insights:**
- **High Score (85+)**: Optimal for localized go-to-market
- **Medium Score (60-84)**: May need regional adjustments
- **Low Score (<60)**: Consider international expansion readiness

#### 4. Revenue Score

**What it measures:** Revenue alignment with ICP target revenue ranges.

**Scoring Logic:**
- **100**: Within target revenue range
- **80-99**: Adjacent revenue range
- **50-79**: Two ranges away
- **0-49**: Significantly different revenue

**Example:**
```
ICP Target: $10M-$50M ARR
Account Revenue: $35M ARR
Revenue Score: 98 (exact match)
```

**Insights:**
- **High Score (85+)**: Strong budget alignment
- **Medium Score (60-84)**: May have budget, needs validation
- **Low Score (<60)**: Budget concerns likely

#### 5. Technology Stack Score

**What it measures:** Presence of complementary/required technologies.

**Scoring Logic:**
- **100**: All required tech present
- **80-99**: Most required tech present
- **50-79**: Some complementary tech present
- **0-49**: Few relevant technologies

**Example:**
```
ICP Required Tech: Salesforce, AWS, Slack
Account Tech Stack: Salesforce, AWS, Microsoft Teams
Tech Score: 75 (2 of 3 matches)
```

**Insights:**
- **High Score (80+)**: Easy integration, technical fit
- **Medium Score (50-79)**: Some integration needed
- **Low Score (<50)**: Significant technical barriers

#### 6. Funding/Growth Score

**What it measures:** Funding status and growth trajectory alignment.

**Scoring Logic:**
- **100**: Recent funding, high growth
- **80-99**: Funded, steady growth
- **50-79**: Bootstrapped or mature
- **0-49**: Declining or distressed

**Example:**
```
ICP Target: Series B-D, $10M+ raised
Account: Series C, $25M raised 6 months ago
Funding Score: 95 (strong match)
```

**Insights:**
- **High Score (85+)**: Budget availability likely
- **Medium Score (60-84)**: Need to validate budget timing
- **Low Score (<60)**: Budget constraints probable

---

## Score Band Interpretation

### Score Band System

LaunchPulse groups scores into **four bands** (A/B/C/D) for easy segmentation:

| Band | Score Range | Label | Meaning |
|------|-------------|-------|---------|
| **A** | 80-100 | High Fit | Top priority, highest conversion likelihood |
| **B** | 60-79 | Medium-High Fit | Strong prospects, good conversion potential |
| **C** | 40-59 | Medium Fit | Qualified leads, nurture required |
| **D** | 0-39 | Low Fit | Poor fit, low priority |

### Band Distribution Analysis

**Healthy Distribution:**
```
A-Band: 5-15% of accounts (top tier)
B-Band: 20-30% of accounts (qualified)
C-Band: 30-40% of accounts (nurture)
D-Band: 20-40% of accounts (exclude)
```

**What Different Distributions Mean:**

**Top-Heavy Distribution** (Many A/B):
```
A: 30%, B: 35%, C: 20%, D: 15%
```
- Indicates strong ICP definition
- High-quality account base
- Efficient targeting

**Bottom-Heavy Distribution** (Many C/D):
```
A: 5%, B: 10%, C: 35%, D: 50%
```
- ICP may be too narrow
- Account base not aligned with ICP
- Consider ICP refinement or new data sources

**Even Distribution**:
```
A: 25%, B: 25%, C: 25%, D: 25%
```
- ICP may need refinement (not selective enough)
- Consider tightening ICP criteria

### Using Score Bands for Campaigns

**A-Band Strategy:**
- **Outreach**: Direct SDR/AE outreach
- **Messaging**: Personalized, value-focused
- **Cadence**: Multi-touch, persistent
- **Resources**: High touch, account-based marketing

**B-Band Strategy:**
- **Outreach**: Automated sequences with personalization
- **Messaging**: Industry-specific, use case driven
- **Cadence**: Standard nurture sequence
- **Resources**: Medium touch, segmented campaigns

**C-Band Strategy:**
- **Outreach**: Marketing automation, content
- **Messaging**: Educational, awareness building
- **Cadence**: Slow nurture, quarterly touchpoints
- **Resources**: Low touch, automated workflows

**D-Band Strategy:**
- **Outreach**: Exclude from active campaigns
- **Messaging**: None (or generic brand awareness)
- **Cadence**: No active outreach
- **Resources**: Minimal (passive inbound only)

---

## Score History and Trends

### Score Timeline

Every account has a **score history** showing how fit scores change over time:

```
Jan 2024: 65 (B) → Mar 2024: 78 (B) → Jun 2024: 85 (A)
         +13         +7
```

### Understanding Score Changes

**Positive Trend (Score Increasing):**

**Causes:**
- Company growth (size, revenue)
- New funding rounds
- Technology stack additions
- Industry shifts toward your ICP

**Actions:**
- Increase outreach priority
- Move to higher-touch engagement
- Assign to senior AE/SDR

**Negative Trend (Score Decreasing):**

**Causes:**
- Company downsizing
- Leadership changes
- Technology stack changes
- Industry shifts away from ICP

**Actions:**
- Reduce outreach frequency
- Monitor for stabilization
- Consider moving to nurture

**Stable Score (No Change):**

**Causes:**
- Static company profile
- No new data enrichment
- Mature, established company

**Actions:**
- Continue current engagement strategy
- Look for behavioral signals
- Enrich with intent data

### Score Volatility

**Low Volatility (±5 points):**
- Stable account profile
- Predictable engagement

**Medium Volatility (±10 points):**
- Growing/changing company
- Monitor for opportunities

**High Volatility (±20+ points):**
- Significant company changes
- Re-validate ICP fit
- May indicate data quality issues

---

## Using Scores for Prioritization

### Account Prioritization Matrix

Combine **fit score** and **engagement/intent** for prioritization:

```
High Intent
│
│  C-Tier          A-Tier
│  (Nurture)       (Immediate Action)
│
│  D-Tier          B-Tier
│  (Ignore)        (Monitor)
│
└───────────────────────────> High Fit Score
```

**Quadrant Definitions:**

**A-Tier (High Fit + High Intent):**
- Immediate SDR/AE outreach
- Executive engagement
- Account-based marketing
- Fastest path to pipeline

**B-Tier (High Fit + Low Intent):**
- Demand generation campaigns
- Intent signal monitoring
- Educational content
- Build awareness

**C-Tier (Low Fit + High Intent):**
- Nurture with marketing
- Product education
- May not convert, but interested
- Low-cost engagement

**D-Tier (Low Fit + Low Intent):**
- No active engagement
- Exclude from campaigns
- Reallocate resources

### Priority Scoring Formula

Combine multiple signals:

```
Priority Score = (Fit Score × 0.6) + (Intent Score × 0.3) + (Engagement Score × 0.1)
```

**Example:**
```
Fit Score: 85
Intent Score: 75
Engagement Score: 60

Priority = (85 × 0.6) + (75 × 0.3) + (60 × 0.1)
Priority = 51 + 22.5 + 6
Priority = 79.5 (High Priority)
```

### Lead Routing Based on Scores

**Routing Rules:**

```javascript
if (fitScore >= 80 && intentScore >= 70) {
  assignTo = "Senior AE";
  priority = "Immediate";
} else if (fitScore >= 70) {
  assignTo = "SDR Team";
  priority = "High";
} else if (fitScore >= 50) {
  assignTo = "Marketing Automation";
  priority = "Nurture";
} else {
  assignTo = "None";
  priority = "Exclude";
}
```

---

## Score Comparison Across ICPs

### Multi-ICP Scoring

Accounts can be scored against **multiple ICPs** simultaneously:

```
Account: Acme Corp
├── ICP 1: Enterprise FinServ → Score: 85 (A)
├── ICP 2: Mid-Market SaaS → Score: 62 (B)
└── ICP 3: SMB Retail → Score: 38 (D)
```

### Primary ICP Assignment

LaunchPulse automatically assigns accounts to their **highest-scoring ICP**:

**Assignment Logic:**
1. Calculate score for each ICP
2. Identify highest score
3. Assign account to that ICP
4. Store scores for all ICPs for reference

**Example:**
```
Account: TechCorp Inc.
Scores:
- Enterprise ICP: 88 → Primary ICP
- Mid-Market ICP: 75
- SMB ICP: 45

Assigned ICP: Enterprise (highest score)
```

### Cross-ICP Analysis

**Use Cases for Multi-ICP Scoring:**

1. **Product Line Fit**: Different products target different ICPs
2. **Upsell Opportunities**: Account grows into higher-tier ICP
3. **Market Expansion**: Account fits multiple segments
4. **Competitive Analysis**: Compare ICP effectiveness

**Dashboard View:**
```
Account: Global Financial Corp

Current ICP: Enterprise Banking (Score: 92)

Alternative ICPs:
├── Enterprise Insurance (Score: 78)
├── Mid-Market Financial Services (Score: 65)
└── SMB FinTech (Score: 42)
```

---

## Propensity Scoring

### What is Propensity Scoring?

**Propensity score** predicts the **likelihood of conversion** based on machine learning models trained on historical closed-won deals.

**Key Difference from Fit Score:**
- **Fit Score**: Measures ICP alignment (firmographic match)
- **Propensity Score**: Predicts conversion probability (ML-based)

### Propensity Score Interpretation

| Score | Conversion Likelihood | Action |
|-------|----------------------|--------|
| **80-100** | Very High (>25%) | Immediate high-touch outreach |
| **60-79** | High (15-25%) | Active sales engagement |
| **40-59** | Medium (8-15%) | Nurture sequences |
| **20-39** | Low (3-8%) | Marketing automation |
| **0-19** | Very Low (<3%) | Minimal engagement |

### Combining Fit and Propensity

**Best Accounts**: High Fit + High Propensity

```
Fit Score: 85 (A-Band)
Propensity Score: 78 (High)
→ Priority Tier: 1 (Highest)
```

**Opportunity Accounts**: Medium Fit + High Propensity

```
Fit Score: 68 (B-Band)
Propensity Score: 82 (Very High)
→ Priority Tier: 2 (High - investigate why propensity is high)
```

**Nurture Accounts**: High Fit + Low Propensity

```
Fit Score: 87 (A-Band)
Propensity Score: 35 (Low)
→ Priority Tier: 3 (Nurture - build intent signals)
```

### Propensity Model Features

LaunchPulse's propensity model considers:
- Firmographic fit (fit score)
- Intent signals (technology changes, funding, hiring)
- Engagement history (email opens, website visits)
- Similar account patterns (lookalike modeling)
- Temporal patterns (sales cycle seasonality)

---

## Best Practices

### 1. Use Scores as a Starting Point, Not Gospel

Scores provide **directional guidance**, not absolute truth:
- Validate high-scoring accounts with research
- Don't ignore low-scoring accounts showing intent
- Combine scores with qualitative insights

### 2. Monitor Score Distribution Trends

Track score band distribution over time:
```
Q1: A=8%, B=22%, C=38%, D=32%
Q2: A=12%, B=28%, C=35%, D=25%  ← Improving
```

**Improving Distribution** = Better ICP alignment or data quality

### 3. Set Score Thresholds for Actions

Define clear thresholds for routing:
```
Score >= 80: Senior AE assignment
Score 60-79: SDR outreach
Score 40-59: Marketing nurture
Score < 40: No active engagement
```

### 4. Re-Score Regularly

Update scores periodically:
- **Real-time**: On data enrichment or updates
- **Scheduled**: Weekly bulk re-scoring
- **Triggered**: On significant account changes

### 5. Analyze Score Dimensions

Don't just look at overall score:
- Identify which dimensions drive low scores
- Target enrichment for missing dimensions
- Adjust ICP if certain dimensions don't matter

### 6. Use Score History for Timing

**Increasing Scores** = Good time for outreach (company growing into your ICP)
**Decreasing Scores** = Pause or re-evaluate engagement

---

## Troubleshooting

### Issue: "Scores seem too low overall"

**Causes:**
- ICP criteria too strict
- Data quality issues (missing fields)
- Weights not calibrated

**Solutions:**
1. Review ICP criteria (broaden if needed)
2. Run bulk enrichment to fill data gaps
3. Recalculate feature weights from closed-won data
4. Validate scoring methodology with sales team

### Issue: "Scores don't match sales intuition"

**Causes:**
- ICP not aligned with actual buying patterns
- Missing qualitative factors in scoring
- Outdated feature weights

**Solutions:**
1. Upload recent closed-won deals
2. Run closed-won analysis to update weights
3. Add qualitative factors (intent signals, tech stack)
4. Review ICP definition with sales leadership

### Issue: "Score changes unexpectedly"

**Causes:**
- Data enrichment updated fields
- ICP criteria changed
- Scoring weights recalculated

**Solutions:**
1. Check enrichment history for account
2. Review ICP change log
3. Check feature weight computation dates
4. Validate data quality for affected dimensions

### Issue: "No scores for accounts"

**Causes:**
- No active ICP profiles
- Accounts missing required scoring fields
- Scoring job failed

**Solutions:**
1. Create/activate ICP profiles
2. Enrich accounts to fill required fields
3. Manually trigger scoring for accounts
4. Check scoring job logs for errors

---

## Related Documentation

- [Fit Score Calculation](../08_Scoring_Engine/Fit_Score_Calculation.md)
- [Statistical V2 Methodology](../08_Scoring_Engine/Statistical_V2_Methodology.md)
- [Propensity Model](../08_Scoring_Engine/Propensity_Model.md)
- [ICP Manager Guide](./ICP_Manager_Guide.md)
- [Campaign Builder Guide](./Campaign_Builder_Guide.md)

---

**Last Updated**: 2024-01-15  
**Version**: 1.0
