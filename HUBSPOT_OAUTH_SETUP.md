# HubSpot OAuth Setup Guide

## Overview

This guide walks you through setting up OAuth 2.0 authentication between your application and HubSpot. OAuth allows secure, token-based authentication for accessing HubSpot CRM data.

**Estimated Time:** 10-15 minutes  
**Difficulty:** Beginner to Intermediate  
**Prerequisites:** HubSpot admin or super admin access required

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup Options: Private App vs OAuth App](#setup-options-private-app-vs-oauth-app)
3. [Option A: Private App Setup (Recommended for Single Org)](#option-a-private-app-setup-recommended-for-single-org)
4. [Option B: OAuth App Setup (For Multi-Customer Deployment)](#option-b-oauth-app-setup-for-multi-customer-deployment)
5. [Step 3: Add Credentials to Supabase](#step-3-add-credentials-to-supabase)
6. [Step 4: Connect in the Application](#step-4-connect-in-the-application)
7. [Step 5: Test the Connection](#step-5-test-the-connection)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)
10. [Testing Checklist](#testing-checklist)

---

## Prerequisites

Before you begin, ensure you have:

- ✅ **HubSpot Admin or Super Admin Access** - Required to create Private Apps or OAuth Apps
- ✅ **HubSpot Pro, Enterprise, or higher** - Free/Starter plans have limited API access
- ✅ **Access to Supabase Dashboard** - You'll need to add secrets to your Supabase project
- ✅ **This Application URL** - `https://dhyfbaptcprxxixgnpby.supabase.co`

### Verify Your HubSpot Permissions

1. Log into **HubSpot**
2. Click your avatar (top-right) → **Profile & Preferences**
3. Go to **Roles & Permissions**
4. Verify you have one of these roles:
   - ✅ **Super Admin** (full access)
   - ✅ **Admin** (can create integrations)
   - ⚠️ **User** (cannot create integrations - upgrade required)

---

## Setup Options: Private App vs OAuth App

HubSpot offers two authentication methods. Choose based on your use case:

| Feature | Private App (Option A) | OAuth App (Option B) |
|---------|----------------------|----------------------|
| **Best For** | Single organization | Multiple customers/orgs |
| **Setup Time** | 5 minutes | 15 minutes |
| **Difficulty** | Easy | Moderate |
| **Token Type** | Long-lived access token | Access + Refresh tokens |
| **User Authorization** | Not required (auto-authorized) | Required (OAuth flow) |
| **Account Needed** | HubSpot account | HubSpot Developer Account |
| **Recommended For** | Testing, single deployment | Production, multi-tenant |

**💡 Recommendation:** Start with **Option A (Private App)** for simplicity. Switch to **Option B (OAuth App)** if you need to deploy to multiple HubSpot organizations.

---

## Option A: Private App Setup (Recommended for Single Org)

Private Apps are the easiest way to connect to HubSpot if you're only connecting your own organization.

### Step A1: Navigate to Private Apps

1. Log into **HubSpot** as an admin
2. Click the **Settings** gear icon (⚙️) in the top-right corner
3. In the left sidebar, scroll down to **Integrations**
4. Click **Private Apps**

**Screenshot Guidance:** You should see a page titled "Private Apps" with a list of existing apps (if any) and a "Create a private app" button.

### Step A2: Create a New Private App

1. Click the **Create a private app** button (top-right)
2. You'll see a form with three tabs: Basic Info, Scopes, Settings

**Screenshot Guidance:** The "Basic Info" tab should be selected by default.

### Step A3: Fill Out Basic Info

In the **Basic Info** tab:

1. **App name:** Enter a descriptive name
   - Example: `ICP Scoring Platform` or `My App Integration`
   
2. **App logo (Optional):** Upload a logo if desired
   - Click "Choose a file" and upload an image (square PNG/JPG recommended)

3. **Description:** Add a brief description
   - Example: "Integration for ICP scoring, account enrichment, and analytics"

Click **Next** to continue to the Scopes tab.

### Step A4: Select Required Scopes

Scopes determine what data your app can access. Select the following scopes:

#### CRM Scopes (Required):

**Companies (Accounts):**
- ✅ `crm.objects.companies.read` - View companies
- ✅ `crm.objects.companies.write` - Create, edit, and delete companies

**Contacts:**
- ✅ `crm.objects.contacts.read` - View contacts
- ✅ `crm.objects.contacts.write` - Create, edit, and delete contacts

**Deals (Opportunities):**
- ✅ `crm.objects.deals.read` - View deals
- ✅ `crm.objects.deals.write` - Create, edit, and delete deals

**Optional but Recommended:**
- ✅ `crm.schemas.companies.read` - Read company properties (for field mapping)
- ✅ `crm.schemas.contacts.read` - Read contact properties
- ✅ `crm.schemas.deals.read` - Read deal properties

**How to select scopes:**
1. Scroll through the list of scopes
2. Check the box next to each required scope
3. You can use the search box to find scopes quickly (e.g., search "companies")

**⚠️ IMPORTANT:** 
- Only select scopes you actually need
- More scopes = more permissions = higher security risk
- You can always add scopes later if needed

### Step A5: Review and Create

1. Review the selected scopes in the summary
2. Click **Create app** button at the bottom
3. A confirmation dialog appears: "Your access token will be shown only once"
4. Click **Continue creating** or **Create app**

**Screenshot Guidance:** After creation, you'll see your app's details page with the access token displayed.

### Step A6: Copy Your Access Token

⚠️ **CRITICAL:** This is your only chance to copy the access token!

1. On the app details page, you'll see **Access token** field
2. Click the **Copy** button next to the access token
3. **Save this value immediately** - you'll need it in Step 3

**Format:** The access token looks like this:
```
pat-na1-11111111-2222-3333-4444-555555555555
```

**If you lose the token:**
- You cannot retrieve it again
- You must **regenerate** the token (Settings tab → Regenerate token)
- Regenerating invalidates the old token

### Step A7: Activate the App

By default, new apps are inactive. To activate:

1. On the app details page, scroll to the top
2. Toggle the **Activate** switch to ON
3. The app status changes to "Active" (green)

**Screenshot Guidance:** You should see a green "Active" badge next to your app name.

---

## Option B: OAuth App Setup (For Multi-Customer Deployment)

OAuth Apps allow multiple HubSpot organizations to connect to your application via the standard OAuth flow.

### Step B1: Create a HubSpot Developer Account

1. Go to [https://developers.hubspot.com/](https://developers.hubspot.com/)
2. Click **Sign Up** (or log in if you already have an account)
3. Complete registration:
   - Enter your email
   - Create a password
   - Verify your email address
4. Complete your developer profile

**Note:** Developer accounts are separate from HubSpot CRM accounts.

### Step B2: Create a New App

1. After logging into the Developer Portal, click **Apps** in the top navigation
2. Click **Create app** button
3. You'll see a form titled "Create an app"

**Screenshot Guidance:** The form has tabs for "App info," "Auth," "Features," etc.

### Step B3: Fill Out App Info

In the **App info** tab:

1. **App name:** Enter a name for your app
   - Example: `ICP Scoring Platform`
   
2. **App logo:** Upload a logo (256x256 PNG recommended)
   
3. **Description:** Enter a public-facing description
   - This will be shown to users during OAuth authorization
   - Example: "Connect your HubSpot CRM to get ICP scoring, account enrichment, and sales analytics."

4. **App listing visibility:** Choose "Unlisted" for now
   - "Unlisted" means only people with the direct link can install
   - "Public" means it appears in HubSpot App Marketplace (requires approval)

5. **Support contact:** Enter your email address

6. Click **Save**

### Step B4: Configure OAuth Settings

1. Click the **Auth** tab
2. You'll see OAuth configuration options

**Redirect URL:**
1. In the **Redirect URLs** section, click **Add redirect URL**
2. Enter this EXACT URL:
   ```
   https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
   ```
3. Click **Add**

⚠️ **IMPORTANT:**
- Must be `https://` (not `http://`)
- No trailing slash
- Exact project ID: `dhyfbaptcprxxixgnpby`

**Scopes:**
Scroll down to the **Scopes** section and select:

**Required Scopes:**
- ✅ `crm.objects.companies.read`
- ✅ `crm.objects.companies.write`
- ✅ `crm.objects.contacts.read`
- ✅ `crm.objects.contacts.write`
- ✅ `crm.objects.deals.read`
- ✅ `crm.objects.deals.write`

**Optional Scopes (Recommended):**
- ✅ `crm.schemas.companies.read`
- ✅ `crm.schemas.contacts.read`
- ✅ `crm.schemas.deals.read`

Click **Save** at the bottom.

### Step B5: Get Your Credentials

1. Stay in the **Auth** tab
2. Scroll to the top of the page
3. You'll see:
   - **App ID:** A numeric ID (not needed for OAuth)
   - **Client ID:** Starts with letters and numbers
   - **Client Secret:** Click "Show" to reveal

**Copy Client ID:**
1. Click the **Copy** button next to Client ID
2. **Save this value** - you'll need it in Step 3

**Copy Client Secret:**
1. Click **Show** to reveal the secret
2. Click the **Copy** button next to Client Secret
3. **Save this value** - you'll need it in Step 3

**Format:**
- **Client ID:** `12345678-1234-1234-1234-123456789012`
- **Client Secret:** `abcdef12-3456-7890-abcd-ef1234567890`

⚠️ **SECURITY WARNING:**
- Never share your Client Secret publicly
- Never commit it to GitHub or version control
- Treat it like a password

### Step B6: Publish Your App (Optional)

For testing, you can skip this step. For production:

1. Click the **Settings** tab
2. Scroll to **App visibility**
3. Toggle **Make app public** to ON
4. Fill out all required fields (privacy policy URL, terms of service, etc.)
5. Submit for HubSpot App Marketplace review (optional)

For now, keep it private/unlisted for testing.

---

## Step 3: Add Credentials to Supabase

Now you'll securely store your HubSpot credentials in Supabase Edge Function secrets.

### 3.1: Access Supabase Dashboard

1. Open your browser and go to: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Log in to your Supabase account
3. Select your project: **dhyfbaptcprxxixgnpby**

### 3.2: Navigate to Edge Function Secrets

1. In the left sidebar, click **Edge Functions**
2. Click the **Manage secrets** button in the top-right
3. You'll see a list of existing secrets (if any)

**Alternative Path:**
1. In the left sidebar, click **Settings** (gear icon at bottom)
2. Click **Edge Functions** in the Settings menu
3. Scroll to the **Secrets** section

### 3.3: Add Credentials Based on Your Setup Option

#### If you used Option A (Private App):

**Add HUBSPOT_API_KEY Secret:**
1. Click **Add new secret** button
2. **Name:** Enter exactly: `HUBSPOT_API_KEY`
   - ⚠️ Must be uppercase, no spaces
3. **Value:** Paste your access token from Step A6
   - Should look like: `pat-na1-11111111-2222-3333-4444-555555555555`
4. Click **Save** or **Add secret**

**Note:** Private Apps use a simple API key, not OAuth credentials.

#### If you used Option B (OAuth App):

**Add HUBSPOT_CLIENT_ID Secret:**
1. Click **Add new secret** button
2. **Name:** Enter exactly: `HUBSPOT_CLIENT_ID`
3. **Value:** Paste your Client ID from Step B5
   - Should look like: `12345678-1234-1234-1234-123456789012`
4. Click **Save**

**Add HUBSPOT_CLIENT_SECRET Secret:**
1. Click **Add new secret** again
2. **Name:** Enter exactly: `HUBSPOT_CLIENT_SECRET`
3. **Value:** Paste your Client Secret from Step B5
   - Should look like: `abcdef12-3456-7890-abcd-ef1234567890`
4. Click **Save**

### 3.4: Verify Secrets

After adding secrets, you should see them in the list:

**For Private App (Option A):**
```
✅ HUBSPOT_API_KEY
```

**For OAuth App (Option B):**
```
✅ HUBSPOT_CLIENT_ID
✅ HUBSPOT_CLIENT_SECRET
```

**Note:** The actual values will be hidden (shown as •••••••) for security.

---

## Step 4: Connect in the Application

Now you'll use the application's UI to connect to HubSpot.

### 4.1: Navigate to Integration Settings

1. Open your application: [Your App URL]
2. Log in if not already logged in
3. Click **Settings** in the left sidebar
4. Click **External Integrations** tab
5. Find the **HubSpot** integration card

**Screenshot Guidance:** You should see a card titled "HubSpot" with a "Connect" button and description.

### 4.2: Connection Flow

The connection flow differs based on whether you used a Private App or OAuth App:

#### For Private App (Option A):

1. Click the **Connect** button on the HubSpot card
2. A dialog appears asking for your API key
3. Paste your access token (from Step A6)
4. Click **Save** or **Connect**
5. The connection is established immediately
6. Status changes to "Connected" (green badge)

#### For OAuth App (Option B):

1. Click the **Connect** button on the HubSpot card
2. A popup window opens redirecting to HubSpot
3. If prompted, log into HubSpot (if not already logged in)
4. You'll see the HubSpot OAuth authorization screen
5. Review the requested permissions
6. Choose which HubSpot account to connect (if you have multiple)
7. Click **Connect app** or **Allow**
8. The popup window closes automatically
9. You'll be redirected back to your application
10. Status changes to "Connected" (green badge)

**Screenshot Guidance (OAuth flow):**
- Authorization screen shows your app name, logo, and requested scopes
- Shows which HubSpot account will be connected
- "Connect app" and "Cancel" buttons at bottom

### 4.3: Verify Connection Status

1. Back in Settings → External Integrations
2. The HubSpot card should now show:
   - ✅ **Status: Connected** (green badge)
   - **Last Sync:** Never (until you trigger a sync)
   - **Connect** button changes to **Disconnect**
   - **Sync Now** and **Settings** buttons appear

---

## Step 5: Test the Connection

Always test your integration after connecting to ensure everything works.

### 5.1: Trigger a Test Sync

1. On the HubSpot card, click **Sync Now** button
2. A sync job will start in the background
3. You'll see a toast notification: "Sync initiated"
4. The card will show "Syncing..." status

### 5.2: Monitor Sync Progress

**Option A: Integration Health Dashboard**
1. Go to Settings → **Integration Health**
2. Find the "HubSpot" row
3. Check the **Last Sync** column - should show "In Progress" or a timestamp
4. Check the **Status** column - should show "Connected" or "Syncing"
5. Check the **Records Synced** column - should increment as data syncs

**Option B: Edge Function Logs**
1. Open Supabase Dashboard
2. Go to Edge Functions → `hubspot-sync`
3. Click **Logs** tab
4. You should see log entries showing sync activity
5. Look for successful responses (200 status codes)

**Direct Link:** [View HubSpot Sync Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/hubspot-sync/logs)

### 5.3: Verify Data in Database

After sync completes (may take 1-3 minutes depending on data size):

1. Go to **Accounts** page in your application
2. You should see HubSpot companies appear
3. Check the **Data Source** column - should show "CRM" for HubSpot records
4. Click on an account to view details - data should match HubSpot

**Alternative - Check Database Directly:**
1. Open Supabase Dashboard → **Table Editor**
2. Select `accounts` table
3. Filter by `data_source = 'crm'`
4. You should see records with HubSpot data

### 5.4: Test Individual API Calls

For advanced testing, use the **Test Connection** feature:

1. Settings → External Integrations → HubSpot card
2. Click the **⋮** (three dots) menu
3. Select **Test Connection**
4. You'll see a test result dialog:
   - ✅ **Connection Status:** Success
   - **Portal ID:** Your HubSpot portal ID
   - **Account Name:** Your HubSpot account name
   - **Records Found:** Count of companies available
5. Click **Close**

---

## Troubleshooting

### Issue 1: "Missing required scopes" Error

**Symptoms:**
- Error message: "This app hasn't been granted all required scopes"
- API calls fail with 403 Forbidden

**Causes:**
- Private App or OAuth App doesn't have all necessary scopes
- Scopes changed after connection

**Solution for Private App:**
1. HubSpot → Settings → Integrations → Private Apps
2. Find your app → Click the app name
3. Go to **Scopes** tab
4. Ensure these scopes are checked:
   - crm.objects.companies.read
   - crm.objects.companies.write
   - crm.objects.contacts.read
   - crm.objects.contacts.write
   - crm.objects.deals.read
   - crm.objects.deals.write
5. Click **Save**
6. Disconnect and reconnect in your application

**Solution for OAuth App:**
1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Find your app → Click **Auth** tab
3. Add missing scopes in the **Scopes** section
4. Click **Save**
5. Disconnect and reconnect in your application (users must re-authorize)

### Issue 2: "Invalid redirect_uri" Error (OAuth App Only)

**Symptoms:**
- Error message: "redirect_uri mismatch" or "The redirect_uri in the request does not match"
- OAuth authorization fails

**Causes:**
- Redirect URL in OAuth App doesn't match callback URL
- Typo in redirect URL
- Missing `https://`

**Solution:**
1. Go to HubSpot Developer Portal → Your App → **Auth** tab
2. Check **Redirect URLs** section
3. Ensure it EXACTLY matches:
   ```
   https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
   ```
4. Check for:
   - ❌ NO trailing slash
   - ✅ `https://` (not `http://`)
   - ✅ Correct project ID
5. Click **Save**
6. Try connecting again

### Issue 3: "Invalid API key" or "Unauthorized" Error

**Symptoms:**
- Error message: "Invalid API key" or 401 Unauthorized
- Connection fails immediately

**Causes:**
- Incorrect access token in Supabase secrets (Private App)
- Access token revoked or expired
- Private App is inactive

**Solution for Private App:**
1. Go to HubSpot → Settings → Integrations → Private Apps
2. Find your app
3. Check if app status is **Active** (toggle to ON if needed)
4. If token was lost or changed, **regenerate token**:
   - Click on your app
   - Go to **Settings** tab
   - Click **Regenerate token**
   - Copy new token
5. Update `HUBSPOT_API_KEY` in Supabase secrets with new token
6. Try connecting again

### Issue 4: "Rate limit exceeded" Error

**Symptoms:**
- Error message: "Too many requests" or 429 status code
- Sync fails partway through

**Causes:**
- Too many API calls in short time
- Exceeded HubSpot's rate limits

**HubSpot Rate Limits:**
- **Free/Starter:** 100 requests per 10 seconds
- **Professional:** 150 requests per 10 seconds
- **Enterprise:** 200 requests per 10 seconds

**Solution:**
1. Reduce sync frequency:
   - Settings → External Integrations → HubSpot → Settings
   - Change **Sync Frequency** to "Daily" instead of "Hourly"
2. Check for duplicate sync jobs:
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE '%hubspot%';
   ```
3. If rate limits are consistently hit, contact HubSpot to increase limits
4. Consider paginating large data sets in edge function

### Issue 5: No Data Syncing

**Symptoms:**
- Sync says "Success" but no data appears
- Empty results in database

**Causes:**
- No companies in HubSpot match ICP filters
- Field mapping issues
- Data already exists (duplicate prevention)

**Solution 1 - Check HubSpot Data:**
1. Log into HubSpot
2. Go to **Contacts** → **Companies**
3. Verify companies exist
4. Check if companies have required fields (name, domain, etc.)

**Solution 2 - Check ICP Filters:**
1. Go to **ICP Manager** page in your application
2. Review your ICP definitions
3. Temporarily broaden filters to sync more data
4. Trigger sync again

**Solution 3 - Check Field Mappings:**
1. Settings → External Integrations → HubSpot → **Field Mapping**
2. Verify default mappings exist:
   - `name` → `name`
   - `domain` → `domain`
   - `industry` → `industry`
3. Click **Save Mappings**
4. Trigger sync again

**Solution 4 - Check Edge Function Logs:**
1. [View Sync Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/hubspot-sync/logs)
2. Look for errors or empty responses
3. Check if API calls return 0 results

### Issue 6: Token Expiration (OAuth App Only)

**Symptoms:**
- Connection works initially but fails after some time
- Error: "Token expired" or "Invalid grant"

**Causes:**
- Access token expired (HubSpot tokens expire after 6 hours)
- Refresh token not working
- Refresh token not stored in database

**Solution:**
1. Check if refresh token exists in database:
   ```sql
   SELECT credential_value->'refresh_token' 
   FROM integration_credentials 
   WHERE integration_id IN (
     SELECT id FROM integration_configs 
     WHERE provider_name = 'hubspot'
   );
   ```
2. Verify `oauth-refresh` edge function is running:
   - [View Token Refresh Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs)
3. If refresh failing, disconnect and reconnect to get new tokens
4. Check if OAuth scopes include `offline_access` (if using custom scope config)

### Issue 7: "App is not authorized" Error (OAuth App Only)

**Symptoms:**
- Error during OAuth flow: "This app has not been authorized for your account"

**Causes:**
- HubSpot admin hasn't approved the app for the account
- App is in "restricted" mode

**Solution:**
1. Contact your HubSpot admin
2. Admin must go to: Settings → Integrations → Connected Apps
3. Find your app in the list
4. Click **Actions** → **Approve**
5. Try connecting again

### Issue 8: Private App Not Appearing in Scopes List

**Symptoms:**
- Created a Private App but can't find it in HubSpot settings

**Causes:**
- App is inactive
- Insufficient permissions to view

**Solution:**
1. Go to HubSpot → Settings → Integrations → Private Apps
2. Check if your app is in the list
3. If missing, verify you have Admin permissions
4. If present but inactive, toggle **Activate** to ON
5. Refresh the page

---

## Security Best Practices

### 1. Protect Your Access Tokens (Private App)

- ✅ **Store in Supabase Secrets** - Never hardcode in your application
- ✅ **Never commit to Git** - Use `.gitignore` for any local credential files
- ✅ **Rotate regularly** - Regenerate tokens every 90-180 days
- ✅ **Limit access** - Only admins should view secrets in Supabase
- ❌ **Never share publicly** - Don't post in Slack, email, tickets

### 2. Protect Your Client Secret (OAuth App)

- ✅ **Store in Supabase Secrets** - Never expose in frontend code
- ✅ **Never commit to Git** - Add to `.gitignore` immediately
- ❌ **Never share publicly** - Treat like a password
- ✅ **Rotate if compromised** - Regenerate immediately if exposed

### 3. Use Minimum Required Scopes

Only request scopes you actually need:
- ✅ **Read scopes** for viewing data
- ✅ **Write scopes** only if you need to modify data
- ❌ **Avoid excessive permissions** - Don't request "all" scopes

**Recommended Minimal Scopes:**
- `crm.objects.companies.read`
- `crm.objects.contacts.read`
- `crm.objects.deals.read`

Add write scopes only if you plan to update HubSpot data from your app.

### 4. Monitor API Usage

HubSpot tracks API calls. Monitor to avoid hitting limits:
1. HubSpot → Settings → Account Defaults → **API Limits**
2. View current usage and remaining calls
3. Set up alerts if approaching limits

### 5. Audit Connected Apps Regularly

Periodically review connected integrations:
1. HubSpot → Settings → Integrations → **Connected Apps**
2. Review list of apps with access
3. Remove any unused or suspicious apps
4. Verify scopes are still appropriate

### 6. Enable Two-Factor Authentication

Protect your HubSpot admin account:
1. HubSpot → Profile & Preferences → **Security**
2. Enable **Two-factor authentication**
3. Use authenticator app (Google Authenticator, Authy, etc.)

### 7. Implement Token Refresh (OAuth App)

For OAuth apps, tokens must be refreshed:
- Access tokens expire after 6 hours
- The `oauth-refresh` edge function handles this automatically
- Runs every 10 minutes via cron job
- Monitor: [View Token Refresh Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs)

---

## Testing Checklist

Use this checklist to ensure your HubSpot integration is fully functional.

### Pre-Connection Tests

**For Private App (Option A):**
- [ ] HubSpot admin access verified
- [ ] Private App created in HubSpot
- [ ] All required scopes selected (companies.read, contacts.read, deals.read, etc.)
- [ ] Access token copied and saved
- [ ] Private App is **Active** (toggle ON)
- [ ] `HUBSPOT_API_KEY` secret added to Supabase

**For OAuth App (Option B):**
- [ ] HubSpot Developer Account created
- [ ] OAuth App created in Developer Portal
- [ ] Redirect URL set correctly: `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback`
- [ ] All required scopes selected
- [ ] Client ID and Client Secret copied
- [ ] Both secrets added to Supabase (`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`)

### Connection Tests

- [ ] "Connect" button appears in application UI
- [ ] **Private App:** Pasting API key connects successfully
- [ ] **OAuth App:** Clicking "Connect" opens HubSpot OAuth popup
- [ ] **OAuth App:** OAuth authorization screen shows correct app name
- [ ] **OAuth App:** Clicking "Connect app" successfully authorizes
- [ ] **OAuth App:** Popup closes automatically after authorization
- [ ] Connection status changes to "Connected" in UI
- [ ] No error messages appear

### Data Sync Tests

- [ ] "Sync Now" button appears after connection
- [ ] Clicking "Sync Now" initiates sync
- [ ] Edge function logs show sync activity ([View Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/hubspot-sync/logs))
- [ ] Companies appear in application's Accounts page
- [ ] Company data matches HubSpot (name, domain, industry, etc.)
- [ ] Contacts sync if configured
- [ ] Deals sync if configured
- [ ] "Last Sync" timestamp updates after sync
- [ ] No errors in Integration Health Dashboard

### Field Mapping Tests

- [ ] Field Mapping dialog opens (Settings → External Integrations → HubSpot → Field Mapping)
- [ ] Source fields from HubSpot are listed
- [ ] Target fields in database are listed
- [ ] Default mappings are correct (name → name, domain → domain, etc.)
- [ ] Custom property mappings can be added
- [ ] Mappings save successfully
- [ ] Next sync uses new field mappings

### Token Refresh Tests (OAuth App Only)

- [ ] `oauth-refresh` edge function exists
- [ ] Cron job is scheduled (`SELECT * FROM cron.job WHERE jobname LIKE '%oauth%';`)
- [ ] Token refresh logs show successful refreshes ([View Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs))
- [ ] Connection remains active after 6+ hours (access token refresh)
- [ ] No "Token expired" errors over time

### Scheduled Sync Tests

- [ ] `CRON_SETUP.sql` script executed
- [ ] Cron job shows in database: `SELECT * FROM cron.job WHERE jobname = 'crm-auto-sync-hourly';`
- [ ] Sync runs automatically at scheduled interval
- [ ] Sync logs show periodic activity (if hourly sync)
- [ ] Sync frequency can be changed in UI

### Error Handling Tests

- [ ] Test with invalid credentials - shows clear error message
- [ ] Test disconnect and reconnect - works smoothly
- [ ] Test with expired token (OAuth) - automatically refreshes
- [ ] Test with rate limit - shows appropriate error
- [ ] Test with network issues - retries or shows error

### Security Tests

- [ ] Access token / Client Secret is hidden in Supabase Dashboard (shows •••••••)
- [ ] Secrets not visible in application UI
- [ ] Secrets not committed to Git repository
- [ ] OAuth state tokens expire after 5 minutes (OAuth App only)
- [ ] Only authorized users can connect integrations

### Performance Tests

- [ ] Sync completes within reasonable time (< 3 minutes for < 500 records)
- [ ] No timeout errors during sync
- [ ] Edge functions don't exceed execution time limits
- [ ] Rate limits not exceeded
- [ ] Large datasets (> 5,000 records) sync successfully (may take longer)

---

## Next Steps

After successfully setting up HubSpot OAuth:

1. **Configure Scheduled Syncs**
   - Follow [CRON_SETUP_INSTRUCTIONS.md](./CRON_SETUP_INSTRUCTIONS.md)
   - Set up hourly/daily automated syncs

2. **Customize Field Mappings**
   - Follow [FIELD_MAPPING_GUIDE.md](./FIELD_MAPPING_GUIDE.md)
   - Map HubSpot custom properties to your schema

3. **Monitor Integration Health**
   - Go to Settings → Integration Health
   - Track sync status, errors, and data quality

4. **Set Up Enrichment Providers**
   - Add ZoomInfo, Apollo, Clearbit API keys
   - Enrich HubSpot data with external sources

5. **Configure Webhooks (Future Feature)**
   - Real-time updates from HubSpot
   - Currently in development

---

## Support Resources

- **Edge Function Logs:** [View HubSpot Sync Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/hubspot-sync/logs)
- **OAuth Callback Logs:** [View OAuth Callback Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-callback/logs)
- **Token Refresh Logs:** [View Token Refresh Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs)
- **Integration Health Dashboard:** Settings → Integration Health in your application
- **HubSpot API Limits:** Settings → Account Defaults → API Limits in HubSpot
- **HubSpot Developer Docs:** [https://developers.hubspot.com/docs/api/overview](https://developers.hubspot.com/docs/api/overview)
- **Troubleshooting Guide:** [TROUBLESHOOTING_INTEGRATIONS.md](./TROUBLESHOOTING_INTEGRATIONS.md)

---

## FAQ

**Q: Should I use a Private App or OAuth App?**  
A: Use Private App for simplicity if you're only connecting your own HubSpot. Use OAuth App if you're deploying to multiple customers.

**Q: Can I convert a Private App to an OAuth App later?**  
A: No, they're separate app types. You'd need to create a new OAuth App and migrate.

**Q: How often should I sync data?**  
A: For most use cases, hourly syncs provide a good balance. Use daily syncs if you have rate limit concerns.

**Q: What happens if I regenerate my Private App token?**  
A: The old token immediately stops working. Update `HUBSPOT_API_KEY` in Supabase with the new token.

**Q: Can multiple users connect to HubSpot?**  
A: With OAuth Apps, yes - each user authorizes separately. Private Apps are account-level, not user-level.

**Q: How do I disconnect HubSpot?**  
A: Go to Settings → External Integrations → HubSpot card → Click "Disconnect" → Confirm.

**Q: What data is synced by default?**  
A: Companies, Contacts, and Deals. You can customize field mappings to include/exclude specific properties.

**Q: Are webhooks supported for HubSpot?**  
A: Not yet. Currently, data is synced via scheduled polling (hourly/daily). Webhook support is planned.

**Q: How do HubSpot rate limits compare to Salesforce?**  
A: HubSpot: 100-200 requests/10 seconds. Salesforce: Daily limits (5,000-100,000+ depending on edition). HubSpot is more restrictive per-second but no daily cap.

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** ICP Scoring Platform Team
