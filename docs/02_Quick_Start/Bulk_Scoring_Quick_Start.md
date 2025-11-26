# Bulk Scoring Quick Start

**Score all your accounts in one click**

## Overview

This guide shows you how to calculate fit scores for all accounts in your database using LaunchPulse's bulk scoring feature.

**Time Required**: 2-3 minutes (setup) + processing time  
**Prerequisites**: At least one active ICP profile

---

## Quick Start: Score All Accounts

### Step 1: Navigate to Bulk Scoring (30 seconds)

**Option A: From Accounts Page**
1. Navigate to **Accounts**
2. Click **"Bulk Actions"** dropdown
3. Select **"Score All Accounts"**

**Option B: From Settings**
1. Navigate to **Settings**
2. Select **Data Quality** → **Score Refresh**
3. Click **"Run Bulk Scoring Job"**

---

### Step 2: Select ICP Profile (30 seconds)

**Single ICP:**
- Select your primary ICP from dropdown
- All accounts will be scored against this ICP

**Multiple ICPs (Pro/Enterprise):**
- Select **"Score Against All ICPs"**
- Each account scored against all active ICPs
- Assigned to highest-scoring ICP

**Recommended:** Start with your primary ICP for first bulk scoring run.

---

### Step 3: Configure Scoring Options (1 minute)

**Filter Accounts (Optional):**

Score only specific accounts:
- [x] All accounts (recommended for first run)
- [ ] Unscored accounts only
- [ ] Accounts with stale scores (>30 days)
- [ ] Specific score bands
- [ ] Custom filter (geography, industry, etc.)

**Re-Scoring Options:**

For accounts already scored:
- [x] Overwrite existing scores (recommended)
- [ ] Skip accounts with scores
- [ ] Only score if data changed

**Chunk Size:**
- Default: `200 accounts per batch`
- Larger chunks = faster, but more memory
- Recommended: Keep default unless processing >10,000 accounts

---

### Step 4: Start Scoring Job (30 seconds)

1. Review configuration summary:
   ```
   Bulk Scoring Job Summary:
   - ICP: Enterprise SaaS - North America
   - Total Accounts: 3,427
   - Unscored: 847
   - Will Re-score: 2,580
   - Estimated Time: 8-12 minutes
   ```

2. Click **"Start Scoring Job"**

3. Job begins processing immediately

---

### Step 5: Monitor Progress (Automatic)

**Progress Indicator:**
```
Scoring Progress:
████████████░░░░░░░░ 65% Complete

Processed: 2,227 / 3,427 accounts
Successful: 2,189
Failed: 38
Estimated Time Remaining: 4 minutes
```

**Real-Time Updates:**
- Progress bar updates every 10 seconds
- Completion percentage
- Accounts processed
- Success/failure counts
- Estimated time remaining

**You Can:**
- Navigate away (job continues in background)
- View results as they're calculated
- Pause job if needed
- Resume later

---

## Understanding Scoring Results

### Job Completion Summary

When scoring completes, you'll see:

```
✅ Bulk Scoring Job Complete!

📊 Results Summary:
- Total Accounts Processed: 3,427
- Successfully Scored: 3,389 (98.9%)
- Failed: 38 (1.1%)
- Time Taken: 11 minutes 23 seconds

🎯 Score Distribution:
- A-Band (High Fit): 412 accounts (12%)
- B-Band (Medium-High Fit): 1,018 accounts (30%)
- C-Band (Medium Fit): 1,287 accounts (38%)
- D-Band (Low Fit): 672 accounts (20%)

⚡ Next Steps:
→ View high-fit accounts
→ Build your first campaign
→ Review failed accounts
```

---

### Reviewing Score Distribution

**Healthy Distribution:**
```
A: 10-20% (top tier)
B: 25-35% (qualified)
C: 30-40% (nurture)
D: 15-25% (low priority)
```

**What Different Distributions Mean:**

**Top-Heavy (many A/B):**
```
A: 30%, B: 35%, C: 20%, D: 15%
```
- ✅ Strong ICP definition
- ✅ High-quality account base
- Consider: Creating more selective A+ segment

**Bottom-Heavy (many C/D):**
```
A: 5%, B: 10%, C: 35%, D: 50%
```
- ⚠️ ICP may be too narrow
- ⚠️ Poor data quality
- Action: Review ICP criteria or run enrichment

**Even Distribution:**
```
A: 25%, B: 25%, C: 25%, D: 25%
```
- ⚠️ ICP not selective enough
- Action: Tighten ICP criteria

---

### Failed Scores Analysis

**Common Failure Reasons:**

| Reason | Count | Action |
|--------|-------|--------|
| Missing required fields | 22 | Run enrichment |
| Invalid data | 8 | Clean data |
| No active ICP | 5 | Create/activate ICP |
| Scoring timeout | 3 | Retry |

**View Failed Accounts:**
1. Click **"View Failed Accounts"** in results
2. Export list for review
3. Fix issues (enrich, clean data)
4. Re-run scoring for failed accounts only

---

## Bulk Scoring Best Practices

### When to Run Bulk Scoring

**Required Scenarios:**
- ✅ After creating a new ICP profile
- ✅ After updating ICP criteria
- ✅ After bulk enrichment
- ✅ After changing feature weights
- ✅ After importing new accounts

**Optional Scenarios:**
- Weekly refresh (keep scores current)
- Before building campaigns
- After CRM sync (if auto-scoring disabled)

---

### Scheduling Automated Scoring

**Set Up Auto-Scoring:**

1. Navigate to **Settings** → **Automations**
2. Find **"Score Refresh"** automation
3. Configure:

```
Auto-Scoring Configuration:
├── Schedule: Daily at 2:00 AM UTC
├── Trigger: Accounts with stale scores (>7 days)
├── ICP: All active ICPs
├── Re-score on: Data changes, enrichment
└── Notify: Admins on completion
```

**Recommended Schedule:**
- **High-Volume**: Daily (for active CRM sync)
- **Standard**: Weekly
- **Low-Volume**: Monthly

---

### Incremental vs. Full Re-Scoring

**Incremental Scoring:**
- Only scores new/updated accounts
- Fast (minutes)
- Runs automatically on triggers

**Full Re-Scoring:**
- Re-calculates all account scores
- Slower (10-30 minutes for 10K accounts)
- Run after major ICP/weight changes

**When to Use Each:**

| Scenario | Type |
|----------|------|
| Daily refresh | Incremental |
| ICP criteria changed | Full |
| Feature weights updated | Full |
| New accounts imported | Incremental |
| Bulk enrichment completed | Full |
| Weekly scheduled job | Incremental |

---

## Advanced Options

### Selective Scoring

Score only specific account segments:

**By Geography:**
```
Filter: Country = "United States"
Result: Only score US accounts
```

**By Industry:**
```
Filter: Industry = "Technology & Software"
Result: Only score Tech accounts
```

**By Data Quality:**
```
Filter: Data Completeness < 60%
Result: Only score low-quality accounts
```

**By Source:**
```
Filter: Data Source = "salesforce"
Result: Only score CRM accounts
```

---

### Multi-ICP Scoring (Pro/Enterprise)

**Scoring Against Multiple ICPs:**

1. Select **"Score Against All ICPs"**
2. LaunchPulse calculates score for each ICP
3. Each account assigned to highest-scoring ICP

**Example Result:**
```
Account: Acme Corp
├── ICP 1 (Enterprise SaaS): 88 → Primary ICP
├── ICP 2 (Mid-Market): 74
└── ICP 3 (SMB): 42

Assigned to: Enterprise SaaS (highest score)
```

**Benefits:**
- Identify cross-sell opportunities
- Segment accounts by fit
- Optimize campaign targeting

---

### Parallel Scoring Jobs

**Run multiple jobs simultaneously:**

1. Job 1: Score US accounts against Enterprise ICP
2. Job 2: Score EU accounts against EMEA ICP
3. Job 3: Re-score stale accounts (>30 days)

**Performance:**
- Jobs run in parallel
- No performance degradation
- Results available independently

---

## Monitoring Scoring Performance

### Scoring Dashboard

View scoring metrics in **Settings** → **Scoring** → **Job History**:

**Key Metrics:**

| Metric | Current | Target |
|--------|---------|--------|
| Accounts Scored | 3,389 / 3,427 | >98% |
| Avg Score Time | 0.19s | <0.5s |
| Failed Accounts | 38 (1.1%) | <2% |
| Data Completeness | 87% | >80% |

**Job History:**
```
Recent Scoring Jobs:
├── 2024-01-15 02:00 - 3,427 accounts - 11m 23s - Success
├── 2024-01-14 02:00 - 3,412 accounts - 10m 58s - Success
├── 2024-01-13 02:00 - 3,389 accounts - 10m 41s - Success
└── 2024-01-12 14:35 - 847 accounts - 3m 12s - Success (Manual)
```

---

### Performance Optimization

**If scoring is slow (>1s per account):**

**Causes:**
- Large database (>100,000 accounts)
- Complex ICP criteria
- Multiple ICP scoring
- High server load

**Solutions:**
1. **Increase chunk size**: 200 → 500 accounts per batch
2. **Schedule off-peak**: Run at night (lower load)
3. **Use incremental scoring**: Only score changed accounts
4. **Optimize ICP**: Simplify criteria if possible
5. **Upgrade instance**: Contact support for larger compute

---

## Troubleshooting

### ❌ Issue: "Scoring job failed to start"

**Causes:**
- No active ICP profiles
- No accounts to score
- Another job already running

**Solutions:**
1. Create/activate an ICP profile
2. Import or sync accounts from CRM
3. Wait for current job to complete
4. Check job queue in Settings → Scoring → Jobs

---

### ❌ Issue: "High failure rate (>5%)"

**Causes:**
- Missing required scoring fields
- Data quality issues
- Invalid data format

**Solutions:**
1. Check Data Quality Dashboard
2. Run bulk enrichment to fill missing fields
3. Export failed accounts and review data
4. Clean invalid data (employee count, revenue)

---

### ❌ Issue: "Scores look incorrect"

**Causes:**
- ICP criteria don't match expectations
- Feature weights not calibrated
- Outdated account data

**Solutions:**
1. Review ICP definition
2. Check feature weights (Settings → Scoring → Weights)
3. Upload closed-won data and recalculate weights
4. Run enrichment to update stale data
5. Manually score a few accounts to validate logic

---

### ❌ Issue: "Job stuck at 0% or not progressing"

**Causes:**
- Database connection issue
- High server load
- Job queue backlog

**Solutions:**
1. Wait 5 minutes (may be in queue)
2. Refresh page to check status
3. Cancel and restart job
4. Check system status page
5. Contact support if persists >15 minutes

---

## Next Steps

### ✅ Scoring Complete - Now What?

**Immediate Actions (Next 5 minutes):**

1. **Review Top Accounts**
   - Navigate to Accounts page
   - Filter: Score Band = A
   - Validate high-fit accounts

2. **Analyze Distribution**
   - Review A/B/C/D percentages
   - Compare to expected distribution
   - Adjust ICP if needed

3. **Fix Failed Scores**
   - Export failed accounts
   - Identify common issues
   - Enrich or clean data

**Within 24 Hours:**

1. **Build Your First Campaign**
   - Follow: [Campaign Export Quick Start](./Campaign_Export_Quick_Start.md)
   - Target A-band accounts
   - Export to CRM or CSV

2. **Set Up Auto-Scoring**
   - Enable automated daily scoring
   - Configure triggers (new accounts, enrichment)
   - Set up completion notifications

3. **Enrich Missing Data**
   - Identify accounts with low data completeness
   - Run bulk enrichment
   - Re-score after enrichment

---

## Related Documentation

- **Scoring Methodology**: [Fit Score Calculation](../08_Scoring_Engine/Fit_Score_Calculation.md)
- **Statistical Details**: [Statistical V2 Methodology](../08_Scoring_Engine/Statistical_V2_Methodology.md)
- **Understanding Scores**: [Scoring Insights Guide](../01_User_Guides/Scoring_Insights_Guide.md)
- **ICP Setup**: [First ICP Creation](./First_ICP_Creation.md)
- **Next Steps**: [Campaign Export Quick Start](./Campaign_Export_Quick_Start.md)

---

## Support

- **Email**: support@launchpulse.io
- **Slack**: #scoring-help
- **Live Chat**: Available in-app

---

**Last Updated**: 2024-01-15  
**Version**: 1.0
