# Week-over-Week Analytics Implementation Guide

## Overview

This implementation adds comprehensive week-over-week (WoW) and month-over-month (MoM) trend tracking to the Executive Dashboard, providing visibility into:
- ICP fit level changes (High/Medium/Low Fit accounts)
- Overall scoring and data completeness progress
- TAM evolution from external data sources
- Geographic distribution changes

## Features Implemented

### 1. Enhanced Trend Calculator (`src/utils/trend-calculator.ts`)
- **Dual Period Support**: Calculates both 7-day (WoW) and 30-day (MoM) trends
- **Fit-Level Tracking**: Monitors changes in High, Medium, and Low Fit account counts
- **Percentage Changes**: Tracks both absolute count changes and percentage shifts
- **Fallback Handling**: Returns zero trends when historical data is unavailable

### 2. Database Schema Updates

#### `data_quality_history` Table
New columns added:
```sql
- medium_fit_accounts (integer) - Count of medium fit accounts
- low_fit_accounts (integer) - Count of low fit accounts  
- high_fit_accounts_delta (integer) - WoW change in high fit
- medium_fit_accounts_delta (integer) - WoW change in medium fit
- low_fit_accounts_delta (integer) - WoW change in low fit
- tam_accounts (integer) - External TAM snapshot
- sam_accounts (integer) - Serviceable addressable market
```

#### `weekly_analytics_snapshots` Table (NEW)
Captures weekly snapshots every Monday at 6:00 AM UTC:
```sql
CREATE TABLE weekly_analytics_snapshots (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  total_accounts integer,
  high_fit_accounts integer,
  medium_fit_accounts integer,
  low_fit_accounts integer,
  high_fit_percentage numeric,
  medium_fit_percentage numeric,
  low_fit_percentage numeric,
  data_completeness numeric,
  tam_accounts integer,
  sam_accounts integer,
  som_accounts integer,
  top_countries jsonb,
  geography_distribution jsonb,
  created_at timestamp with time zone,
  UNIQUE(org_id, snapshot_date)
);
```

### 3. UI Components

#### `CombinedScoringICPCard` - Enhanced
Now displays week-over-week trends for each fit level:
- Shows absolute change (+5 accounts)
- Shows percentage change (+2.3%)
- Color-coded green (positive) / red (negative) indicators
- Trend arrows (↑/↓) for visual clarity

Example display:
```
High Fit
1,234 accounts
+8 (+0.6%) vs 7d ↑
```

#### `TAMTrendCard` - NEW Component
Dedicated card showing TAM evolution:
- Current TAM accounts and contacts
- Week-over-week growth percentage
- Historical line chart (last 12 weeks)
- Provider information (Apollo, ZoomInfo, etc.)
- Last sync timestamp

#### `EnhancedGeographyCard` - Enhanced
Top countries now show week-over-week account changes:
```
United States
1,234 accounts (45.2%)
↑12 vs last week
```

### 4. Weekly Snapshot Edge Function

**Location**: `supabase/functions/weekly-analytics-snapshot/index.ts`

**Purpose**: Automatically captures weekly snapshots of key metrics

**Captures**:
- Total accounts and fit distribution
- ICP match percentages
- Data completeness scores
- TAM/SAM/SOM values
- Top 10 countries with account counts
- Complete geography distribution

**Execution**: 
- Runs every Monday at 6:00 AM UTC via cron
- Can be manually triggered for testing

## Setup Instructions

### Step 1: Run Database Migrations
The migrations have already been applied automatically. Verify by checking:
```sql
-- Check data_quality_history columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'data_quality_history';

-- Check weekly_analytics_snapshots table exists
SELECT * FROM weekly_analytics_snapshots LIMIT 1;
```

### Step 2: Deploy Edge Function
The edge function `weekly-analytics-snapshot` has been created and will be deployed automatically with your next build.

To verify deployment, check the Supabase dashboard:
https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/weekly-analytics-snapshot/logs

### Step 3: Setup Weekly Cron Job

**IMPORTANT**: You need to manually run the SQL setup to enable weekly snapshots.

1. Open the Supabase SQL Editor:
   https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/sql/new

2. Copy and run the SQL from `WEEKLY_SNAPSHOT_CRON_SETUP.sql`

3. Verify the cron job:
```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-analytics-snapshot';
```

### Step 4: Manual Test (Optional but Recommended)
Test the snapshot function before waiting for Monday:

```sql
SELECT net.http_post(
    url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/weekly-analytics-snapshot',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body:='{"triggered_at": "manual"}'::jsonb
) as request_id;
```

Check the results:
```sql
SELECT * FROM weekly_analytics_snapshots ORDER BY created_at DESC LIMIT 5;
```

## How It Works

### Data Flow

1. **Weekly Snapshot (Monday 6 AM UTC)**
   ```
   Cron Trigger → Edge Function → Database
   ```
   - Edge function queries all orgs
   - Calculates current metrics
   - Inserts/updates `weekly_analytics_snapshots`

2. **Trend Calculation (Real-time)**
   ```
   Dashboard Load → calculateTrends() → Compare with Historical Data
   ```
   - Queries historical data from 7 or 30 days ago
   - Calculates deltas (current - historical)
   - Returns trend metrics

3. **Display (Live)**
   ```
   Trend Data → React Components → Visual Indicators
   ```
   - Components receive trend props
   - Display badges, arrows, and charts
   - Color-coded for quick scanning

### Timeline for Visible Trends

- **Day 1-6**: No trends visible (need 7 days of data)
- **Day 7+**: Week-over-week trends appear
- **Day 30+**: Month-over-month trends appear
- **Week 2+**: TAM evolution chart shows trend line

### Current Dashboard Behavior

Until historical data accumulates:
- Trend indicators show "0 pts vs 7d/30d"
- TAM chart displays "No historical TAM data yet"
- Fit level cards show values without trend badges

After first snapshot:
- Week-over-week trends become visible
- TAM evolution chart shows data points
- Geographic trends show account changes

## Troubleshooting

### No Trends Showing
**Issue**: All trends show 0 or are not visible

**Solution**:
1. Check if snapshots are running:
```sql
SELECT * FROM weekly_analytics_snapshots 
WHERE org_id = 'YOUR_ORG_ID' 
ORDER BY snapshot_date DESC;
```

2. Verify cron job status:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'weekly-analytics-snapshot' 
ORDER BY start_time DESC 
LIMIT 5;
```

3. Manually trigger snapshot (see Step 4 above)

### Cron Not Running
**Issue**: Cron job doesn't execute on schedule

**Solution**:
1. Verify `pg_cron` extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Check cron schedule syntax:
```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-analytics-snapshot';
```

3. Review edge function logs for errors:
https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/weekly-analytics-snapshot/logs

### TAM Trend Card Not Showing
**Issue**: TAM trend card doesn't appear on dashboard

**Solution**:
1. Verify Apollo/ZoomInfo integration is active:
```sql
SELECT * FROM external_data_sources 
WHERE org_id = 'YOUR_ORG_ID' AND is_active = true;
```

2. Check TAM data exists:
```sql
SELECT * FROM external_data_sources 
WHERE org_id = 'YOUR_ORG_ID' AND total_accounts > 0;
```

3. If no TAM data, the TAMSAMSOMCalculator component shows instead

## Future Enhancements

### Phase 2 (Recommended)
- [ ] Add 90-day (quarterly) trend calculations
- [ ] Create trend comparison charts for all metrics
- [ ] Add trend alerts (email when fit levels drop >10%)
- [ ] Export trend reports to PDF

### Phase 3 (Advanced)
- [ ] Predictive trend forecasting using historical data
- [ ] Benchmark trends against industry averages
- [ ] Custom trend periods (14d, 60d, etc.)
- [ ] Trend correlation analysis (what drives high fit growth?)

## API Reference

### `calculateTrends(orgId, currentMetrics, period)`
Calculates trend data comparing current metrics to historical data.

**Parameters**:
- `orgId` (string): Organization UUID
- `currentMetrics` (object): Current dashboard metrics
- `period` ('7d' | '30d'): Comparison period

**Returns**: `Promise<TrendData>`
```typescript
interface TrendData {
  scoringProgress: number;
  completeness: number;
  highFitAccounts: number;
  mediumFitAccounts: number;
  lowFitAccounts: number;
  highFitPercentage: number;
  mediumFitPercentage: number;
  lowFitPercentage: number;
  campaignReady: number;
}
```

### Weekly Snapshot Edge Function
**Endpoint**: `POST /functions/v1/weekly-analytics-snapshot`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer [ANON_KEY]"
}
```

**Response**:
```json
{
  "success": true,
  "snapshotsCreated": 5,
  "date": "2024-01-15"
}
```

## Performance Considerations

### Query Optimization
- Historical queries use indexed `created_at` column
- Snapshots table has composite index on `(org_id, snapshot_date)`
- Trend calculations happen async (no blocking)

### Data Retention
- Keep last 52 weeks of snapshots (1 year)
- Older data archived or aggregated monthly
- Implement cleanup job after 1 year

### Caching
- Dashboard data cached for 0ms (always fresh for TAM)
- Trend calculations run client-side (no API calls)
- Weekly snapshots cached in database

## Links

- [Supabase Functions Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions)
- [Edge Function Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/weekly-analytics-snapshot/logs)
- [SQL Editor](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/sql/new)
- [Cron Jobs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/database/extensions)

## Support

For issues or questions:
1. Check edge function logs first
2. Verify database migrations completed
3. Test manual snapshot trigger
4. Review this documentation

---

**Last Updated**: 2024-01-10  
**Version**: 1.0  
**Status**: ✅ Fully Implemented
