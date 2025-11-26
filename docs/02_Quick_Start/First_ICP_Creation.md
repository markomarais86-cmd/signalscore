# First ICP Creation Guide

**Create your first Ideal Customer Profile in 10 minutes**

## Overview

This guide walks you through creating your first ICP profile in LaunchPulse, enabling automatic fit scoring for all your accounts.

**Time Required**: 10 minutes  
**Prerequisites**: Accounts synced from CRM or uploaded

---

## Quick Start: Create ICP in 3 Steps

### Step 1: Navigate to ICP Manager (30 seconds)

1. Click **ICP Manager** in the left sidebar
2. Click **"Create New ICP"** button
3. Select **"Guided Wizard"** (recommended for first ICP)

### Step 2: Define ICP Criteria (7 minutes)

#### 2.1 Basic Information (1 minute)

**ICP Name**:
```
Enterprise SaaS - North America
```

**Description** (optional):
```
Mid to large B2B SaaS companies in North America with 
200-2000 employees, $10M-$100M revenue, using Salesforce.
```

**Category**:
- Select: `Enterprise` or `Mid-Market` or `SMB`

**Priority**:
- Set to: `High` (for primary ICP)

---

#### 2.2 Firmographic Criteria (3 minutes)

**Company Size:**
- Min Employees: `200`
- Max Employees: `2000`
- Why: Right-sized for your solution complexity

**Industry:**

Select from normalized industries:
- [x] Technology & Software
- [x] SaaS
- [ ] Financial Services
- [ ] Healthcare
- [ ] Manufacturing

**Revenue Range:**

Select applicable ranges:
- [ ] $1M-$10M
- [x] $10M-$50M
- [x] $50M-$100M
- [ ] $100M-$500M

**Geography:**

**Countries:**
- [x] United States
- [x] Canada
- [ ] United Kingdom
- [ ] Germany

**Regions** (optional):
- Select specific states if needed: CA, NY, TX, MA

---

#### 2.3 Technology Stack (2 minutes)

**Required Technologies:**

Select technologies that indicate good fit:
- [x] Salesforce (CRM)
- [x] AWS or Azure (Cloud)
- [x] Slack (Collaboration)
- [ ] HubSpot
- [ ] Marketo

**Why Tech Stack Matters:**
- Indicates technical sophistication
- Shows budget for software
- Suggests integration compatibility

**Excluded Technologies** (optional):

List technologies that indicate poor fit:
- Competitor products
- Incompatible legacy systems

---

#### 2.4 Funding & Growth (1 minute)

**Funding Status:**
- [x] Series B
- [x] Series C
- [x] Series D
- [ ] Series E+
- [ ] Public

**Growth Stage:**
- [x] Growth Stage
- [ ] Early Stage
- [ ] Mature

---

### Step 3: Save and Validate ICP (2 minutes)

1. Click **"Save ICP"**
2. LaunchPulse will show validation results:

**Validation Output:**
```
✅ ICP Created: "Enterprise SaaS - North America"

📊 Validation Results:
- Total Matching Accounts: 847
- High Fit (A): 127 accounts (15%)
- Medium-High Fit (B): 254 accounts (30%)
- Medium Fit (C): 312 accounts (37%)
- Low Fit (D): 154 accounts (18%)

🎯 TAM Estimate: $42.3M
📈 Data Quality Score: 87%
```

3. Click **"Score All Accounts"** to calculate fit scores

---

## Understanding Your ICP Results

### Match Distribution

**Healthy Distribution:**
```
A-Band: 10-20% (high-quality targets)
B-Band: 25-35% (qualified prospects)
C-Band: 30-40% (nurture candidates)
D-Band: 15-25% (low priority)
```

**What It Means:**

- **Top-Heavy (many A/B)**: Very selective ICP, great for ABM
- **Bottom-Heavy (many C/D)**: ICP too narrow or poor data quality
- **Even Distribution**: ICP may need refinement

### Score Calculation Preview

**How Scores Are Calculated:**

```
Acme Corp Example:
├── Company Size: 450 employees → Score: 95
├── Industry: SaaS → Score: 100
├── Geography: California, US → Score: 100
├── Revenue: $35M → Score: 95
├── Tech Stack: Salesforce, AWS, Slack → Score: 100
└── Overall Fit Score: 97 (A-Band)
```

**Feature Weights** (can be customized):
- Company Size: 25%
- Industry: 25%
- Geography: 20%
- Revenue: 15%
- Tech Stack: 10%
- Funding: 5%

---

## Refining Your ICP

### Too Few Matches (<100 accounts)

**Your ICP is too narrow**

**Solutions:**
1. **Broaden employee range**: Expand from 200-2000 to 100-5000
2. **Add more industries**: Include adjacent industries
3. **Expand geography**: Add more countries/regions
4. **Reduce required tech**: Make some tech stack requirements optional

**Example Adjustment:**
```
Before: 200-2000 employees, only SaaS, only US
After: 100-5000 employees, SaaS + Tech, US + Canada
Result: 87 accounts → 427 accounts
```

---

### Too Many Matches (>5,000 accounts)

**Your ICP is too broad**

**Solutions:**
1. **Narrow employee range**: Focus on sweet spot (e.g., 500-2000)
2. **Be more specific on industry**: Choose sub-industries
3. **Add required technologies**: Filter by tech stack
4. **Tighten geography**: Focus on specific regions

**Example Adjustment:**
```
Before: 50-10,000 employees, all Tech, worldwide
After: 500-2000 employees, B2B SaaS, North America, requires Salesforce
Result: 8,234 accounts → 1,247 accounts
```

---

### Most Accounts Are C/D Band

**Your criteria don't match your account base**

**Solutions:**
1. **Review closed-won accounts**: What do they have in common?
2. **Check data quality**: Missing fields affect scores
3. **Run enrichment**: Fill in missing firmographic data
4. **Adjust criteria**: Align ICP with actual best customers

**Data Quality Check:**
```
Navigate to: Settings → Data Quality Dashboard

Check:
- % of accounts with employee count
- % of accounts with industry
- % of accounts with geography
- % of accounts with revenue

Goal: >80% completeness for each field
```

---

## Using Templates for Faster Setup

### Pre-Built ICP Templates

LaunchPulse includes templates for common use cases:

**Available Templates:**

1. **Enterprise B2B SaaS**
   - 500-5000 employees
   - $50M-$500M revenue
   - Technology sector
   - North America + Europe

2. **Mid-Market SaaS**
   - 100-1000 employees
   - $10M-$100M revenue
   - Multiple industries
   - North America focused

3. **SMB SaaS**
   - 10-200 employees
   - $1M-$20M revenue
   - All industries
   - Broad geography

4. **Financial Services**
   - 200-10,000 employees
   - Banking, Insurance, Investment
   - Regulated tech stack
   - US + UK focus

5. **Healthcare**
   - 100-5000 employees
   - Hospitals, Health Systems, Payers
   - HIPAA-compliant tech
   - US focused

**Using a Template:**

1. Click **"Use Template"** during ICP creation
2. Select relevant template
3. Review pre-filled criteria
4. Customize to your specific needs
5. Save and validate

---

## Best Practices

### 🎯 Start Narrow, Then Expand

**Phase 1** (Week 1): Create a narrow, high-confidence ICP
- Focus on your best customers
- Be selective on criteria
- Aim for 100-500 matches

**Phase 2** (Week 2-4): Create secondary ICPs
- Adjacent markets
- Different company sizes
- Geographic expansion

**Phase 3** (Month 2+): Refine based on results
- Analyze conversion rates by ICP
- Adjust criteria based on actual wins
- Create sub-ICPs for variations

---

### 📊 Use Closed-Won Data

**If you have historical closed-won deals:**

1. Upload closed-won deals (CSV or CRM sync)
2. Run closed-won analysis
3. LaunchPulse will show patterns:
   ```
   Top Characteristics of Closed-Won Deals:
   - Avg Employee Count: 743
   - Top Industries: SaaS (34%), FinTech (18%), Healthcare Tech (12%)
   - Top Regions: California (28%), New York (15%), Texas (12%)
   - Avg Revenue: $47M
   - Tech Stack: 89% use Salesforce, 76% use AWS
   ```

4. Use these insights to define your ICP criteria

---

### 🔄 Iterate Based on Results

**Monthly ICP Review:**

1. Review conversion rates by ICP
2. Analyze won/lost deals
3. Identify patterns in high-performing accounts
4. Adjust ICP criteria accordingly

**Metrics to Track:**
- Win rate by score band (A vs B vs C)
- Average deal size by ICP
- Sales cycle length by ICP
- Pipeline velocity by ICP

---

## Next Steps

### ✅ ICP Created - Now What?

**Immediate Actions (Next 10 minutes):**

1. **Review Top Accounts**
   - Navigate to Accounts page
   - Filter: Score Band = A
   - Review your highest-fit accounts
   - Validate: "Do these look right?"

2. **Check Data Quality**
   - Settings → Data Quality Dashboard
   - Identify missing fields
   - Run bulk enrichment if needed

3. **Set Up Auto-Scoring**
   - Settings → Automations
   - Enable: "Auto-score new accounts"
   - Enable: "Re-score on enrichment"

**Within First Week:**

1. **Create Your First Campaign**
   - Follow: [Campaign Export Quick Start](./Campaign_Export_Quick_Start.md)
   - Target A-band accounts
   - Export to CRM or CSV
   - Begin outreach

2. **Add Enrichment**
   - Connect enrichment providers (PDL, Clearbit)
   - Run bulk enrichment on missing data
   - Improve score accuracy

3. **Monitor Results**
   - Track campaign performance
   - Analyze which accounts convert
   - Refine ICP based on learnings

---

## Advanced: Multiple ICPs

### When to Create Multiple ICPs

**Scenarios for Multiple ICPs:**

1. **Different Product Lines**
   - Product A: Enterprise ICP
   - Product B: Mid-Market ICP

2. **Geographic Expansion**
   - ICP 1: North America
   - ICP 2: Europe
   - ICP 3: APAC

3. **Vertical Specialization**
   - ICP 1: Financial Services
   - ICP 2: Healthcare
   - ICP 3: Retail

4. **Company Stage Segmentation**
   - ICP 1: Growth Stage (Series B-D)
   - ICP 2: Mature (Late-stage, Public)

### Managing Multiple ICPs

**Primary vs. Secondary ICPs:**
- Set one ICP as **Primary** (default for scoring)
- Mark others as **Secondary** (alternative segments)

**Account Assignment:**
- Each account scores against all ICPs
- Assigned to highest-scoring ICP
- View scores for all ICPs in account detail

**Campaign Building:**
- Build campaigns for specific ICPs
- Compare performance across ICPs
- Optimize resource allocation

---

## Troubleshooting

### ❌ Issue: "No accounts match my ICP"

**Causes:**
- ICP criteria too restrictive
- Account data incomplete
- No accounts in database yet

**Solutions:**
1. Broaden employee range
2. Add more industries/geographies
3. Check data completeness in Data Quality Dashboard
4. Run bulk enrichment to fill missing fields
5. Import more accounts from CRM

---

### ❌ Issue: "All accounts are high-fit (A-band)"

**Causes:**
- ICP too broad
- All criteria have low thresholds
- Data quality issues (missing dimensions)

**Solutions:**
1. Tighten ICP criteria (narrower employee range)
2. Add required technologies
3. Be more specific on industry
4. Check feature weights (Settings → Scoring → Weights)
5. Run closed-won analysis to calibrate

---

### ❌ Issue: "Scores don't match sales intuition"

**Causes:**
- ICP doesn't reflect actual best customers
- Feature weights not calibrated
- Missing qualitative factors

**Solutions:**
1. Upload closed-won deals
2. Run closed-won analysis
3. Use auto-calculated feature weights
4. Add missing dimensions (tech stack, funding)
5. Review ICP with sales team

---

## Related Documentation

- **Detailed ICP Guide**: [ICP Manager Guide](../01_User_Guides/ICP_Manager_Guide.md)
- **Scoring Methodology**: [Fit Score Calculation](../08_Scoring_Engine/Fit_Score_Calculation.md)
- **Feature Weights**: [Scoring Weights](../08_Scoring_Engine/Scoring_Weights.md)
- **Next Steps**: [Bulk Scoring Quick Start](./Bulk_Scoring_Quick_Start.md)
- **Campaign Building**: [Campaign Export Quick Start](./Campaign_Export_Quick_Start.md)

---

## Support

- **Email**: support@launchpulse.io
- **Slack**: #icp-setup
- **Live Chat**: Available in-app

---

**Last Updated**: 2024-01-15  
**Version**: 1.0
