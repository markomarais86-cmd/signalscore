# CRM Integration Setup Instructions

This guide provides step-by-step instructions for setting up Salesforce and HubSpot integrations with LaunchPulse.

---

## Table of Contents

1. [Salesforce Setup](#salesforce-setup)
2. [HubSpot Setup](#hubspot-setup)
3. [Post-Connection Testing](#post-connection-testing)
4. [Troubleshooting](#troubleshooting)

---

## Salesforce Setup

LaunchPulse uses **Username/Password authentication** for Salesforce. This method requires your Salesforce credentials and a security token.

### Prerequisites

- Salesforce Professional Edition or higher
- Admin or user with API access permissions
- Your Salesforce security token

### Step 1: Get Your Salesforce Security Token

1. Log in to Salesforce
2. Click your profile icon (top right) → **Settings**
3. In the left sidebar, go to **My Personal Information** → **Reset My Security Token**
4. Click **Reset Security Token**
5. Check your email for the new security token (sent to your Salesforce email)

> **Note:** If you don't see "Reset My Security Token", your org may have IP restrictions. Contact your Salesforce admin.

### Step 2: Connect Salesforce in LaunchPulse

1. Go to **Settings** → **Integrations** tab
2. Find **Salesforce** in the integration list
3. Click **Connect**
4. Enter your credentials:
   - **Username:** Your Salesforce username (email)
   - **Password:** Your Salesforce password
   - **Security Token:** The token from Step 1
   - **Instance URL:** Usually `https://login.salesforce.com` (or `https://test.salesforce.com` for sandbox)
5. Click **Save & Connect**

### Step 3: Configure Sync Settings

1. After connecting, configure your sync preferences:
   - **Sync Frequency:** Hourly, Daily, or Manual
   - **Sync Direction:** One-way (Salesforce → LaunchPulse) or Bi-directional
2. Click **Save Settings**
3. Click **Sync Now** to perform initial sync

### What Gets Synced from Salesforce

| Salesforce Object | LaunchPulse Table | Fields Synced |
|-------------------|-------------------|---------------|
| Account | accounts | Name, Website (domain), Industry, EmployeeCount, AnnualRevenue, BillingCountry |
| Contact | contacts | FirstName, LastName, Email, Title, AccountId |
| Opportunity | Leads | Name, StageName, Amount, CloseDate, AccountId |

---

## HubSpot Setup

LaunchPulse uses **OAuth 2.0 authentication** for HubSpot. This requires creating a HubSpot Developer App.

### Prerequisites

- HubSpot account with Super Admin access
- Access to HubSpot Developer portal

### Step 1: Create a HubSpot Developer App

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Sign in with your HubSpot account
3. Click **Apps** in the top navigation
4. Click **Create app**
5. Fill in the app details:
   - **App Name:** LaunchPulse Integration
   - **Description:** CRM sync for LaunchPulse

### Step 2: Configure OAuth Settings

1. In your app, go to the **Auth** tab
2. Set the **Redirect URL** to:
   ```
   https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
   ```
3. Under **Scopes**, select the following:
   - `crm.objects.companies.read`
   - `crm.objects.contacts.read`
   - `crm.objects.deals.read`
   - `crm.schemas.companies.read`
   - `crm.schemas.contacts.read`
   - `crm.schemas.deals.read`
4. Click **Save**

### Step 3: Get Your Client ID and Secret

1. In the **Auth** tab, find:
   - **Client ID** (starts with a UUID)
   - **Client Secret** (click to reveal)
2. Copy both values - you'll need them in the next step

### Step 4: Add Secrets to Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add two new secrets:
   - **Name:** `HUBSPOT_CLIENT_ID`
   - **Value:** Your Client ID from Step 3
   
   - **Name:** `HUBSPOT_CLIENT_SECRET`
   - **Value:** Your Client Secret from Step 3
4. Click **Save**

### Step 5: Connect HubSpot in LaunchPulse

1. Go to **Settings** → **Integrations** tab
2. Find **HubSpot** in the integration list
3. Click **Connect**
4. You'll be redirected to HubSpot's authorization page
5. Select the HubSpot account you want to connect
6. Review the permissions and click **Grant Access**
7. You'll be redirected back to LaunchPulse

### Step 6: Configure Sync Settings

1. After connecting, configure your sync preferences:
   - **Sync Frequency:** Hourly, Daily, or Manual
2. Click **Save Settings**
3. Click **Sync Now** to perform initial sync

### What Gets Synced from HubSpot

| HubSpot Object | LaunchPulse Table | Fields Synced |
|----------------|-------------------|---------------|
| Company | accounts | Name, Domain, Industry, Number of Employees, Annual Revenue, Country |
| Contact | contacts | FirstName, LastName, Email, Job Title, Associated Company |
| Deal | Leads | Deal Name, Deal Stage, Amount, Close Date, Associated Company |

---

## Post-Connection Testing

After connecting your CRM, verify the integration is working:

### Test Checklist

- [ ] **Connection Status:** Integration shows as "Connected" in Settings
- [ ] **Initial Sync:** Click "Sync Now" and wait for completion
- [ ] **Accounts Synced:** Go to Accounts page and verify CRM accounts appear
- [ ] **Contacts Synced:** Check that contacts are linked to accounts
- [ ] **No Errors:** Check sync history for any error messages

### Verify Data Quality

1. Go to **Executive Dashboard**
2. Check the **Data Source Breakdown** card
3. You should see accounts split between "CRM" and "Database" sources

### Test Campaign Export (Optional)

1. Create a test campaign in Campaign Builder
2. Select a few accounts
3. Try exporting to your CRM
4. Verify the campaign appears in Salesforce/HubSpot

---

## Troubleshooting

### Salesforce Issues

#### "Invalid username, password, or security token"

- Verify your username is correct (usually your email)
- Reset your security token and try again
- Check if your IP needs to be whitelisted in Salesforce

#### "API_DISABLED_FOR_ORG"

- Your Salesforce edition may not include API access
- Contact Salesforce support to enable API access

#### "REQUEST_LIMIT_EXCEEDED"

- You've hit Salesforce API limits
- Wait 24 hours or contact Salesforce to increase limits

### HubSpot Issues

#### "Missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET"

- Ensure secrets are added in Supabase Edge Function settings
- Double-check the secret names match exactly

#### "Invalid redirect URI"

- Verify the redirect URL in HubSpot matches exactly:
  ```
  https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
  ```

#### "No HubSpot credentials found"

- The OAuth flow may not have completed
- Try disconnecting and reconnecting HubSpot

#### "Token expired"

- HubSpot tokens expire after 6 hours
- The system should auto-refresh, but if not, reconnect HubSpot

### General Issues

#### Sync shows 0 records

- Check if your CRM has any data
- Verify the user has access to view records in the CRM
- Check edge function logs for errors

#### Data not appearing after sync

- Refresh the page
- Check the Accounts page filter (might be filtered to wrong source)
- Verify sync completed successfully in sync history

### Checking Edge Function Logs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions)
2. Click on the relevant function (`hubspot-sync` or `salesforce-sync`)
3. Click **Logs** to see recent execution logs
4. Look for error messages that explain the issue

---

## Support

If you continue to experience issues:

1. Check the edge function logs for detailed error messages
2. Verify all prerequisites are met
3. Try disconnecting and reconnecting the integration
4. Contact support with:
   - Error message (if any)
   - Screenshot of integration status
   - Edge function logs

---

## Quick Reference

### Supabase Project Details

- **Project ID:** `dhyfbaptcprxxixgnpby`
- **Edge Functions URL:** `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/`

### Required Supabase Secrets for HubSpot

| Secret Name | Description |
|-------------|-------------|
| `HUBSPOT_CLIENT_ID` | HubSpot OAuth Client ID |
| `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth Client Secret |

### OAuth Callback URL

```
https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
```

### HubSpot Required Scopes

```
crm.objects.companies.read
crm.objects.contacts.read
crm.objects.deals.read
crm.schemas.companies.read
crm.schemas.contacts.read
crm.schemas.deals.read
```
