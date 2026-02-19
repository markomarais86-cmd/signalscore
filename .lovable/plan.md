

# Alerts Configuration UI

## What This Solves

Right now, the auto-provisioning system creates API credit and service health alerts for every org, but there's **no way to configure them** from the app. The `slack_webhook_url` and `webhook_url` fields are both empty, so alerts fire but have nowhere to deliver notifications. You'd need to manually edit the database to set these up.

This adds an **Alerts & Notifications** tab to Settings so you can manage everything from the UI.

## What You'll Get

1. **Alerts table view** showing all configured alerts with their status, type, threshold, and last triggered time
2. **Inline editing** for Slack webhook URL, generic webhook URL, email recipients, and thresholds
3. **Toggle switches** to enable/disable individual alerts
4. **Create new alert** dialog for adding custom alerts (e.g., win rate drops, velocity changes)
5. **Test alert** button to fire a test notification and confirm Slack/webhook delivery works

## Where It Lives

A new **"Alerts"** tab in Settings (visible to admins only), placed between "Automation & AI" and "Exports".

## UI Layout

The tab will show:

- **Header section**: Title + "Add Alert" button
- **Alert cards/rows**: One per alert, each showing:
  - Alert name and type badge (e.g., "API Credits Low", "Service Degraded")
  - Active/Inactive toggle
  - Threshold value + operator (e.g., "Less than 100 credits")
  - Notification channels with status indicators (Slack: configured/not configured, Webhook: configured/not configured)
  - Last triggered timestamp
  - Edit and Delete buttons
- **Edit dialog**: Opens inline or as a sheet with fields for:
  - Alert name
  - Threshold value and operator
  - Slack webhook URL (with paste + test button)
  - Generic webhook URL
  - Email recipients (comma-separated)
  - Channel toggles (Slack, Webhook, Email)

## Technical Details

### New File
- `src/components/settings/AlertsConfiguration.tsx` -- The full alerts management component

### Modified Files
- `src/pages/Settings.tsx` -- Add the new "Alerts" tab (lazy-loaded), add Bell icon import, add TabsTrigger and TabsContent

### Data Flow
- Reads from `alerts` table filtered by `org_id`
- Updates `alerts` table directly (threshold_value, threshold_operator, slack_webhook_url, webhook_url, email_recipients, notification_channels, is_active)
- "Test Alert" calls the `check-alerts` edge function with `{ orgId, testMode: true }` (will add testMode support to skip threshold evaluation)

### Edge Function Update
- `supabase/functions/check-alerts/index.ts` -- Add `testMode` flag that bypasses threshold checks and sends a test notification to configured channels

### Alert Types Supported
| Type | Description | Default Threshold |
|------|-------------|-------------------|
| api_credits_low | API credits running low | Less than 100 |
| service_degraded | Provider health failures | 3 or more failures |
| velocity_drop | Deal velocity declining | Existing |
| win_rate_decline | Win rate dropping | Existing |
| slippage | Deal slippage detected | Existing |

