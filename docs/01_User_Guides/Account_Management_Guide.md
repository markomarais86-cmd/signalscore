# Account Management Guide

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse Product Team

## Overview

The Accounts page is your central hub for viewing, filtering, scoring, and enriching company data. This guide covers everything you need to effectively manage accounts in LaunchPulse, from understanding the interface to taking bulk actions.

## Accessing the Accounts Page

**Navigation:** Click **Accounts** in the left sidebar

**Default View:** Shows all accounts in your database, sorted by most recently updated

**Key Metrics (Top of Page):**
- **Total Accounts**: All accounts in your database
- **Scored Accounts**: Accounts with ICP fit scores
- **Campaign Ready**: Accounts with A/B scores + contacts
- **Avg Score**: Average ICP fit score across all accounts

## Account Table Columns

### Standard Columns

| Column | Description | Use Case |
|--------|-------------|----------|
| **Name** | Company name | Primary identifier |
| **Domain** | Website domain | Quick research link |
| **Industry** | Normalized industry classification | Segmentation |
| **Employees** | Employee count | Company size filtering |
| **Revenue** | Revenue range (e.g., "$10M-$50M") | TAM analysis |
| **Country** | Headquarters country | Geographic filtering |
| **Score** | ICP fit score (0-100) | Prioritization |
| **Band** | Score band (A/B/C/D) | Quick filtering |
| **Contacts** | Number of associated leads | Reachability assessment |
| **Last Scored** | Timestamp of last scoring | Data freshness |

### Score Band Indicators

| Band | Color | Score Range | Meaning |
|------|-------|-------------|---------|
| **A** | Green | 80-100 | Excellent fit - top priority |
| **B** | Blue | 60-79 | Good fit - high priority |
| **C** | Yellow | 40-59 | Moderate fit - monitor |
| **D** | Gray | 0-39 | Poor fit - low priority |
| **-** | White | Not scored | Awaiting scoring |

## Filtering Accounts

### Quick Filters (Top Bar)

**Score Band Filter:**
```
[All Bands ▼] [A] [B] [C] [D] [Not Scored]
```
Click a band to show only accounts in that range.

**ICP Filter:**
```
[All ICPs ▼] → Select specific ICP profile
```
Filter by which ICP was used for scoring.

**Source Filter:**
```
[All Sources ▼] [CRM] [Enriched] [Manual Upload] [External DB]
```
Filter by data origin.

**Geography Filter:**
```
[All Countries ▼] → Multi-select countries
```

**Industry Filter:**
```
[All Industries ▼] → Multi-select industries
```

### Advanced Filters (Click "More Filters")

**Company Size:**
```
Employees: [Min: 0] to [Max: 10000]
```

**Revenue Range:**
```
☐ <$1M
☐ $1M-$10M
☐ $10M-$50M
☐ $50M-$100M
☐ $100M-$500M
☐ $500M-$1B
☐ >$1B
```

**Data Completeness:**
```
Min Completeness: [0%] ────●──── [100%]
```
Filter accounts with sufficient data for scoring.

**Has Contacts:**
```
☐ Only accounts with contacts
```

**Enrichment Status:**
```
☐ Needs enrichment (missing key fields)
☐ Recently enriched (< 30 days)
☐ Never enriched
```

**Technology Stack:**
```
Must have: [Salesforce] [HubSpot] [+ Add tech]
```

### Saving Custom Views

```
Apply filters → Click "Save View" → Name: "High-Fit Enterprise"
```

Access saved views from the dropdown: `[Saved Views ▼]`

**Default Views:**
- **All Accounts** - No filters
- **High Priority** - A/B bands with contacts
- **Needs Enrichment** - Missing key fields
- **Recent Updates** - Updated in last 7 days

## Account Detail Drawer

**Opening:** Click any account row to open the detail drawer on the right

### Overview Tab

**Company Information:**
- Name, Domain, Industry, Description
- Employee Count, Revenue Range, Funding Stage
- Headquarters Location (Country, State, City)
- LinkedIn URL, Tech Stack

**ICP Fit Score:**
- Overall score with score band badge
- Dimension breakdown (bar chart):
  - Industry Match: 95/100
  - Geography Match: 80/100
  - Company Size Match: 90/100
  - Revenue Match: 85/100
  - Technology Match: 75/100
  - Funding Signals: 100/100
- Data Completeness: 92%
- Last Scored: 2 hours ago

**Quick Actions:**
- **Re-score**: Trigger immediate re-scoring
- **Enrich**: Launch enrichment for missing fields
- **Add to Campaign**: Add to campaign builder
- **View in CRM**: Open in Salesforce/HubSpot (if synced)

### Contacts Tab

**Contact List:**
Shows all leads associated with this account.

| Name | Title | Email | Phone | Reachability | Persona Match |
|------|-------|-------|-------|--------------|---------------|
| John Doe | VP Sales | john@example.com | +1-555-0100 | 87% | 92% |
| Jane Smith | Director Marketing | jane@example.com | - | 65% | 78% |

**Actions:**
- **Add Contact**: Manually add a contact to this account
- **Discover Contacts**: Launch AI contact discovery (finds contacts matching your persona)
- **Export Contacts**: Download CSV of all contacts

### History Tab

**Activity Timeline:**
```
Nov 26, 2025 10:30 AM - Scored (Band A, 87.5)
Nov 25, 2025 3:15 PM - Enriched (PDL + Clearbit)
Nov 24, 2025 9:00 AM - Created (Salesforce sync)
```

**Enrichment History:**
- Shows all enrichment attempts
- Provider used (PDL, Clearbit, AI)
- Fields enriched
- Cost (if applicable)

**Score History:**
- Historical scores over time (line chart)
- ICP changes that affected score
- Data quality improvements

### Insights Tab

**AI-Generated Insights:**
- Why this account is a good fit
- Recommended messaging angles
- Potential objections
- Best contact timing
- Similar accounts that converted

**Example Insight:**
```
💡 This account matches 5 of 6 closed-won patterns:
   - Enterprise SaaS company
   - 200-500 employees
   - Recently raised Series B
   - Using Salesforce + HubSpot
   - North America headquarters

📊 Similar accounts have a 34% close rate (vs 12% average)

💬 Recommended messaging: Focus on scalability and integration capabilities
```

## Bulk Actions

**Selecting Accounts:**
- **Select All**: Click checkbox in table header
- **Select Specific**: Click checkboxes on individual rows
- **Select by Filter**: Apply filters, then "Select all matching (247 accounts)"

### Available Bulk Actions

**1. Bulk Scoring**
```
Select accounts → Actions ▼ → Score Selected Accounts
```
- Choose ICP profile
- Estimated time displayed
- Runs in background (receive email notification when complete)

**2. Bulk Enrichment**
```
Select accounts → Actions ▼ → Enrich Selected Accounts
```
Options:
- **Smart Enrich**: Auto-selects missing fields (recommended)
- **Full Enrich**: All phases (Phase 2-4)
- **Custom**: Select specific fields to enrich

Cost estimate shown before confirmation.

**3. Add to Campaign**
```
Select accounts → Actions ▼ → Add to Campaign
```
Opens campaign builder with selected accounts pre-filtered.

**4. Export to CSV**
```
Select accounts → Actions ▼ → Export to CSV
```
Choose columns to export:
- Standard fields (name, domain, industry, etc.)
- Score and band
- Contact count
- Enrichment metadata

**5. Assign to User**
```
Select accounts → Actions ▼ → Assign to User
```
Assign accounts to team members for follow-up (Enterprise only).

**6. Merge Duplicates**
```
Select duplicate accounts → Actions ▼ → Merge Accounts
```
- Choose which account to keep as primary
- All contacts, scores, and history merged into primary
- Duplicate marked as merged (not deleted)

## Searching & Sorting

### Search Bar

**Search by:**
- Company name (fuzzy match)
- Domain (exact or partial)
- Industry (partial match)

**Example Searches:**
- `acme` - Finds "Acme Corp", "Acme Industries", etc.
- `salesforce.com` - Finds accounts with domain salesforce.com
- `software` - Finds accounts in software industry

### Sorting Options

Click any column header to sort:
- **Name**: Alphabetical (A-Z or Z-A)
- **Score**: Highest/lowest first
- **Employees**: Largest/smallest first
- **Last Scored**: Most/least recent

**Multi-Column Sort:**
Hold Shift and click multiple headers (e.g., sort by Band, then by Score within each band).

## Data Quality Indicators

### Completeness Badge

Each account shows a data completeness percentage:
- **90-100%**: ✓ Excellent (green)
- **70-89%**: ⚠ Good (yellow)
- **< 70%**: ⚠ Needs enrichment (red)

**Required Fields for 100% Completeness:**
1. Industry
2. Employee count
3. Revenue range
4. Country
5. Tech stack (at least 1 technology)

### Enrichment Phase Indicator

Shows which enrichment phase the account has completed:
- **Phase 1**: CRM data only (gray)
- **Phase 2**: Basic enrichment - PDL + firmographics (blue)
- **Phase 3**: Advanced enrichment - Clearbit + tech stack (purple)
- **Phase 4**: AI enrichment - GPT-4 inference (gold)

## Best Practices

### Weekly Account Review Workflow

**Monday Morning (30 minutes):**
1. **Filter for New A/B Accounts**
   - Score Band: A, B
   - Last Scored: Last 7 days
2. **Review Top 20**
   - Check contacts (sufficient reachability?)
   - Read AI insights
   - Add to campaign if ready
3. **Enrich Incomplete Accounts**
   - Filter: Data Completeness < 80%
   - Bulk enrich top 50

**Friday Afternoon (15 minutes):**
1. **Check Scoring Progress**
   - Filter: Not Scored
   - Bulk score unscored accounts
2. **Export Weekly Report**
   - Export A/B accounts to CSV
   - Share with sales team

### Enrichment Strategy

**Prioritize enrichment budget:**
1. **Tier 1 (High Priority)**: A/B band accounts with < 80% completeness
2. **Tier 2 (Medium Priority)**: C band accounts with contacts
3. **Tier 3 (Low Priority)**: D band accounts (consider skipping)

**Cost-Effective Enrichment:**
- Use "Smart Enrich" (only enriches missing fields)
- Set monthly budget in Settings → Enrichment
- Review spend weekly in Enrichment Analytics dashboard

### Campaign Building Workflow

1. **Start with ICP**: Select your target ICP profile
2. **Apply Score Filter**: A/B bands only
3. **Filter by Geography**: Match your sales team's coverage
4. **Require Contacts**: "Only accounts with contacts" checkbox
5. **Review Count**: Aim for 100-500 accounts (optimal campaign size)
6. **Open Campaign Builder**: Add to campaign and apply persona filters

## Troubleshooting

### Issue: Accounts Not Showing Up

**Check:**
1. **Filters Applied?** - Click "Clear All Filters"
2. **ICP Selected?** - Try "All ICPs"
3. **Search Query?** - Clear search bar
4. **Synced from CRM?** - Check Settings → Integrations → Last Sync

### Issue: Scores Seem Wrong

**Possible Causes:**
1. **Old ICP Definition** - Update ICP, then re-score
2. **Missing Data** - Enrich account to improve accuracy
3. **Wrong ICP Applied** - Check which ICP was used in detail drawer

**Fix:**
- Click account → Overview → Re-score button
- Or bulk re-score: Select accounts → Actions → Score Selected

### Issue: Enrichment Failed

**Check Enrichment History (Detail Drawer → History):**
- Error message shown (e.g., "Domain not found", "Rate limit exceeded")
- Provider that failed (PDL, Clearbit, AI)

**Retry:**
- Click account → Overview → Enrich button
- Select specific enrichment phase to retry

### Issue: Slow Performance (Large Account Lists)

**Optimization Tips:**
1. **Apply Filters**: Reduce result set size
2. **Pagination**: Use Next/Previous instead of "Show All"
3. **Save Views**: Pre-filter common queries
4. **Export to CSV**: For analysis in Excel/Sheets

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search bar |
| `↑` `↓` | Navigate account rows |
| `Enter` | Open selected account detail drawer |
| `Esc` | Close detail drawer |
| `Ctrl+A` | Select all accounts |
| `Ctrl+D` | Deselect all |

## Related Documentation

- [ICP Manager Guide](./ICP_Manager_Guide.md)
- [Campaign Builder Guide](./Campaign_Builder_Guide.md)
- [Scoring Insights Guide](./Scoring_Insights_Guide.md)
- [Executive Dashboard Guide](./Executive_Dashboard_Guide.md)

## Support

For account management questions:
- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **Live Chat**: Click ? icon in bottom right

---

**Guide Version:** 1.0  
**Last Updated:** 2025-11-26  
**Applies to:** LaunchPulse v2.0+
