# Scoring Overview

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Product Team

## What is ICP Scoring?

ICP (Ideal Customer Profile) Scoring is a data-driven method to evaluate how well an account matches your target customer profile. LaunchPulse assigns each account a score from 0-100, plus an A/B/C band classification.

**Use cases**:
- **Prioritize outreach**: Focus sales efforts on high-fit (A-band) accounts
- **Segment campaigns**: Build targeted campaigns for different ICP segments
- **Measure TAM/SAM**: Understand your addressable market size
- **Track data quality**: Identify accounts needing enrichment

## How Scores are Calculated

### Multi-Dimensional Scoring

LaunchPulse evaluates accounts across 6 dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Industry** | 25% | Does the account operate in your target industries? |
| **Geography** | 20% | Is the account located in your target regions? |
| **Company Size** | 20% | Does employee count match your ICP range? |
| **Revenue** | 15% | Is the company's revenue in your target range? |
| **Technology** | 10% | Does the account use your target tech stack? |
| **Funding** | 10% | Recent funding or growth stage signals |

### Scoring Example

**ICP Definition**:
- Industries: `Software, SaaS, Cloud Computing`
- Geographies: `United States, Canada, United Kingdom`
- Company Sizes: `201-1000 employees`
- Revenue: `$10M-50M`
- Tech Stack: `Salesforce, HubSpot, AWS`

**Account: Acme Corp**:
- Industry: `SaaS` → **100% match** → 25 points
- Geography: `United States` → **100% match** → 20 points
- Employees: `350` → **100% match** → 20 points
- Revenue: `$25M` → **100% match** → 15 points
- Tech Stack: `Salesforce, AWS` → **67% match** → 6.7 points
- Funding: `Series B, raised $15M` → **100% match** → 10 points

**Total Score**: 96.7 → **A Band** (High Fit)

## Score Bands

Scores are grouped into bands for easy filtering:

| Band | Score Range | Color | Meaning |
|------|-------------|-------|---------|
| **A** | 80-100 | 🟢 Green | Perfect fit - highest priority for outreach |
| **B** | 60-79 | 🟡 Yellow | Good fit - qualified prospects |
| **C** | 40-59 | 🟠 Orange | Potential fit - needs nurturing |
| **D** | 0-39 | 🔴 Red | Poor fit - low priority |

### Band Distribution (Your Accounts)

As of November 2025:
- **A Band**: 1,837 accounts (15.8%) - Focus here first
- **B Band**: 4,521 accounts (38.9%) - Qualified prospects
- **C Band**: 3,890 accounts (33.5%) - Nurture campaigns
- **D Band**: 1,370 accounts (11.8%) - Deprioritize

## Data Quality Impact

**Complete data = accurate scores**

Scores are more accurate when accounts have complete firmographic data:

| Completeness | Impact on Score | Example |
|--------------|-----------------|---------|
| **5/5 fields** | 100% confidence | All dimensions scored accurately |
| **4/5 fields** | 90% confidence | Slightly reduced score (10% penalty) |
| **3/5 fields** | 75% confidence | Reduced score (25% penalty) |
| **<3/5 fields** | ❌ No score | Insufficient data to score |

**Required fields**:
1. Industry
2. Geography (Country)
3. Company Size (Employee Count)
4. Revenue Range
5. Tech Stack (optional, but helpful)

**💡 Tip**: Use the [Bulk Enrichment](../01_User_Guides/Settings_Configuration.md#enrichment) feature to improve data completeness and get more accurate scores.

## Closed-Won Boosting

If you've uploaded historical closed-won deals, LaunchPulse automatically learns which dimensions correlate with actual wins and boosts scores accordingly.

**Example**:
- Analysis shows that "SaaS" industry closes 2.5x more than others
- All SaaS accounts receive a +10 point boost
- This personalized model improves scoring accuracy over time

**See**: [Closed-Won Analysis](./Closed_Won_Analysis.md) for details.

## When Scores Update

Scores are automatically recalculated when:

1. **Account data changes**: New enrichment data arrives
2. **ICP is modified**: You update your ICP definition
3. **Manual re-score**: You click "Refresh Scores" in Settings
4. **Bulk scoring job**: Scheduled daily scoring job runs
5. **New closed-won data**: Upload new wins to retrain the model

**⏱️ Scoring Speed**:
- Single account: < 1 second
- Bulk scoring (1,000 accounts): ~2-3 minutes
- Full database (10,000+ accounts): ~25 minutes

## Viewing Scores

### In the Accounts Table

Navigate to **Accounts** to see scores:
- **Score Column**: Displays the 0-100 score
- **Band Badge**: Shows A/B/C/D band with color coding
- **Filters**: Filter by band (e.g., show only A-band accounts)
- **Sorting**: Sort by score (highest to lowest)

### In the Executive Dashboard

The **Executive Dashboard** shows:
- **Score Distribution Chart**: Breakdown by band
- **Average Score**: Your portfolio's average ICP fit score
- **Score Trends**: How your score distribution changes over time
- **Top Accounts**: Highest-scored accounts needing outreach

### In Account Detail Drawer

Click any account to see:
- **Overall Score**: Large score display with band
- **Dimension Breakdown**: How each dimension contributed
- **Score History**: Timeline of score changes
- **Confidence Level**: Based on data completeness

## Scoring Best Practices

### 1. Start with a Clear ICP
- Define your ICP before scoring
- Use closed-won deals to inform your ICP
- Start narrow, expand later

### 2. Enrich Before Scoring
- Run bulk enrichment first
- Target 80%+ data completeness
- Focus on accounts you care about

### 3. Review Score Distribution
- **Healthy distribution**: 15-20% A-band, 35-45% B-band
- **Too many A-bands**: Your ICP may be too broad
- **Too few A-bands**: Your ICP may be too narrow

### 4. Act on Scores
- **A-band accounts**: Immediate outreach, high-touch
- **B-band accounts**: Nurture campaigns, regular follow-up
- **C-band accounts**: Long-term nurture, content marketing
- **D-band accounts**: Exclude from campaigns, monitor only

### 5. Iterate and Refine
- Review closed-won deals quarterly
- Adjust ICP based on actual wins
- Test different ICP variations
- Track score-to-conversion rates

## Common Questions

### Q: Why isn't my account scored?
**A**: The account needs at least 3/5 required fields. Check data completeness and run enrichment.

### Q: Can I customize dimension weights?
**A**: Not yet, but this is planned for Q1 2026. Current weights are based on industry best practices.

### Q: How often should I re-score?
**A**: Automatic re-scoring happens daily. Manual re-scoring is useful after:
- Major ICP changes
- Bulk enrichment completion
- Uploading new closed-won data

### Q: What's the difference between Fit Score and Propensity Score?
**A**:
- **Fit Score** (0-100): How well the account matches your ICP definition
- **Propensity Score** (0-1.0): ML-predicted probability of conversion (requires closed-won data)

### Q: Can I have multiple ICPs with different scoring?
**A**: Yes! Create multiple ICP profiles, and each account will receive a separate score for each ICP.

## Troubleshooting

### Low Scores Across the Board
- **Check ICP definition**: Is it too restrictive?
- **Check data quality**: Are accounts missing firmographic data?
- **Run enrichment**: Improve data completeness

### Unexpected Score Changes
- **View score history**: Click account → "Score History" tab
- **Check enrichment logs**: New data may have arrived
- **Review ICP changes**: Did someone modify the ICP?

### Scoring Job Stuck
- Navigate to **Settings** → **Scoring** → **Bulk Scoring Jobs**
- Check job status and error logs
- Contact support if job is stuck >30 minutes

## Related Documentation

- [ICP Manager Guide](../01_User_Guides/ICP_Manager_Guide.md) - Create and manage ICPs
- [Scoring Engine Architecture](../00_Architecture/Scoring_Engine_Architecture.md) - Technical details
- [Closed-Won Analysis](./Closed_Won_Analysis.md) - Train from historical wins
- [Campaign Builder Guide](../01_User_Guides/Campaign_Builder_Guide.md) - Use scores to build campaigns

## Support

For scoring questions:
- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **In-App Help**: Click the ? icon in the Scoring page
