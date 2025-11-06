# Salesforce OAuth Setup Guide

## Overview

This guide walks you through setting up OAuth 2.0 authentication between your application and Salesforce. OAuth allows secure, token-based authentication without exposing your Salesforce credentials.

**Estimated Time:** 15-20 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Salesforce admin access required

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create a Connected App in Salesforce](#step-1-create-a-connected-app-in-salesforce)
3. [Step 2: Configure OAuth Settings](#step-2-configure-oauth-settings)
4. [Step 3: Get Your Credentials](#step-3-get-your-credentials)
5. [Step 4: Add Credentials to Supabase](#step-4-add-credentials-to-supabase)
6. [Step 5: Connect in the Application](#step-5-connect-in-the-application)
7. [Step 6: Test the Connection](#step-6-test-the-connection)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)
10. [Testing Checklist](#testing-checklist)

---

## Prerequisites

Before you begin, ensure you have:

- ✅ **Salesforce Admin Access** - You need "Customize Application" and "Manage Connected Apps" permissions
- ✅ **API Enabled** - Your Salesforce user must have "API Enabled" permission
- ✅ **Access to Supabase Dashboard** - You'll need to add secrets to your Supabase project
- ✅ **This Application URL** - `https://dhyfbaptcprxxixgnpby.supabase.co`

### Verify Your Salesforce Permissions

1. Log into Salesforce
2. Click your avatar → **Settings**
3. Go to **Quick Find** → Search for "Users"
4. Click **Users** → Find your user → Click **Edit**
5. Verify these checkboxes are enabled:
   - ✅ **API Enabled**
   - ✅ Your profile has "Modify All Data" or "API Enabled" permission

---

## Step 1: Create a Connected App in Salesforce

A Connected App is Salesforce's way of allowing external applications to connect via OAuth.

### 1.1: Navigate to App Manager

1. Log into **Salesforce** as an administrator
2. Click the **gear icon** (⚙️) in the top-right corner
3. Select **Setup**
4. In the **Quick Find** box (left sidebar), type: `App Manager`
5. Click **App Manager** under **Apps**

**Screenshot Guidance:** You should see a list of existing apps with columns for "App Label," "App Name," "Type," etc.

### 1.2: Create New Connected App

1. Click the **New Connected App** button (top-right)
2. You'll see a form titled "New Connected App"

**Screenshot Guidance:** The form should have sections for "Basic Information," "API (Enable OAuth Settings)," and "Web App Settings."

---

## Step 2: Configure OAuth Settings

### 2.1: Fill Out Basic Information

In the **Basic Information** section:

1. **Connected App Name:** Enter a descriptive name
   - Example: `ICP Scoring Platform` or `My App - Production`
   
2. **API Name:** This auto-fills based on your Connected App Name
   - Example: `ICP_Scoring_Platform`
   
3. **Contact Email:** Enter your email address
   - Example: `admin@yourcompany.com`

4. **Description (Optional):** Add a description
   - Example: "OAuth integration for ICP scoring and analytics platform"

5. **Logo (Optional):** Upload a logo if desired

### 2.2: Enable OAuth Settings

Scroll down to the **API (Enable OAuth Settings)** section:

1. **Check the box:** ✅ **Enable OAuth Settings**

2. **Callback URL:** Enter this EXACT URL (critical):
   ```
   https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
   ```
   
   ⚠️ **IMPORTANT:** 
   - No trailing slash
   - Must be `https://` (not `http://`)
   - Copy/paste to avoid typos
   - This URL cannot be changed after OAuth is set up without breaking the connection

3. **Selected OAuth Scopes:** Move these scopes from "Available OAuth Scopes" to "Selected OAuth Scopes":
   - ✅ **Access the identity URL service (id, profile, email, address, phone)**
   - ✅ **Access and manage your data (api)**
   - ✅ **Perform requests on your behalf at any time (refresh_token, offline_access)**
   - ✅ **Full access (full)** - Optional but recommended for complete data access

   **How to add scopes:**
   - Click a scope in the left box (Available OAuth Scopes)
   - Click the **Add** button (→) to move it to the right box
   - Repeat for all required scopes

4. **Require Secret for Web Server Flow:** ✅ Check this box (recommended)

5. **Require Secret for Refresh Token Flow:** ✅ Check this box (recommended)

6. **Enable Authorization Code and Credentials Flow:** ✅ Check this box

### 2.3: Configure Policies (Important)

Scroll down to **OAuth Policies** section:

1. **Permitted Users:** Select **"All users may self-authorize"**
   - This allows any user in your Salesforce org to authorize
   - Alternatively, select "Admin approved users are pre-authorized" if you want to restrict access

2. **IP Relaxation:** Select **"Relax IP restrictions"**
   - This allows connections from any IP address
   - Select "Enforce IP restrictions" only if you have a static IP

3. **Refresh Token Policy:** Select **"Refresh token is valid until revoked"**
   - This ensures tokens don't expire unexpectedly

### 2.4: Save the Connected App

1. Scroll to the bottom of the page
2. Click **Save**
3. You'll see a warning: "It may take up to 10 minutes for your changes to take effect"
   - ⏰ **IMPORTANT:** Wait at least 5-10 minutes before testing OAuth
4. Click **Continue**

**Screenshot Guidance:** After saving, you should see your Connected App details page with sections for "Consumer Key," "Consumer Secret," etc.

---

## Step 3: Get Your Credentials

After saving, Salesforce will display your OAuth credentials. These are like your API keys.

### 3.1: Locate Consumer Key (Client ID)

1. On the Connected App details page, find the **API (Enable OAuth Settings)** section
2. Look for **Consumer Key**
3. Click **Copy** button next to Consumer Key
4. **Save this value** - you'll need it in Step 4

**Format:** The Consumer Key looks like this:
```
3MVG9l2zHsylwlpR7g...longString...kGnN8I7.abcde
```

### 3.2: Locate Consumer Secret (Client Secret)

1. Below Consumer Key, find **Consumer Secret**
2. Click **Click to reveal** to show the secret
3. Click the **Copy** button to copy the secret
4. **Save this value** - you'll need it in Step 4

**Format:** The Consumer Secret looks like this:
```
1234567890123456789
```

⚠️ **SECURITY WARNING:**
- **Never** share your Consumer Secret publicly
- **Never** commit it to GitHub or version control
- Store it securely (password manager, secure notes)
- Treat it like a password - if exposed, regenerate it immediately

### 3.3: Optional - Set Up Callback URL in Your Org

If you're using a custom Salesforce domain (e.g., `mycompany.my.salesforce.com`):

1. Go to **Setup** → **Quick Find** → Search "Remote Site Settings"
2. Click **Remote Site Settings**
3. Click **New Remote Site**
4. **Remote Site Name:** Enter `Supabase_OAuth`
5. **Remote Site URL:** Enter `https://dhyfbaptcprxxixgnpby.supabase.co`
6. ✅ Check **Active**
7. Click **Save**

This allows Salesforce to communicate with your application's callback URL.

---

## Step 4: Add Credentials to Supabase

Now you'll securely store your Salesforce credentials in Supabase Edge Function secrets.

### 4.1: Access Supabase Dashboard

1. Open your browser and go to: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Log in to your Supabase account
3. Select your project: **dhyfbaptcprxxixgnpby**

### 4.2: Navigate to Edge Function Secrets

1. In the left sidebar, click **Edge Functions**
2. Click the **Manage secrets** button in the top-right
3. You'll see a list of existing secrets (if any)

**Alternative Path:**
1. In the left sidebar, click **Settings** (gear icon at bottom)
2. Click **Edge Functions** in the Settings menu
3. Scroll to the **Secrets** section

### 4.3: Add SALESFORCE_CLIENT_ID Secret

1. Click **Add new secret** or **+ New secret** button
2. **Name:** Enter exactly: `SALESFORCE_CLIENT_ID`
   - ⚠️ Must be uppercase, no spaces
   - Use underscores, not dashes
3. **Value:** Paste your Consumer Key from Step 3.1
   - Should look like: `3MVG9l2zHsylwlpR7g...`
4. Click **Save** or **Add secret**

### 4.4: Add SALESFORCE_CLIENT_SECRET Secret

1. Click **Add new secret** again
2. **Name:** Enter exactly: `SALESFORCE_CLIENT_SECRET`
3. **Value:** Paste your Consumer Secret from Step 3.2
   - Should look like: `1234567890123456789`
4. Click **Save** or **Add secret**

### 4.5: Verify Secrets

After adding both secrets, you should see them in the list:
```
✅ SALESFORCE_CLIENT_ID
✅ SALESFORCE_CLIENT_SECRET
```

**Note:** The actual values will be hidden (shown as •••••••) for security.

---

## Step 5: Connect in the Application

Now you'll use the application's UI to connect to Salesforce using OAuth.

### 5.1: Navigate to Integration Settings

1. Open your application: [Your App URL]
2. Log in if not already logged in
3. Click **Settings** in the left sidebar
4. Click **External Integrations** tab
5. Find the **Salesforce** integration card

**Screenshot Guidance:** You should see a card titled "Salesforce" with a "Connect" button and description.

### 5.2: Initiate OAuth Flow

1. Click the **Connect** button on the Salesforce card
2. A popup window will open redirecting to Salesforce
3. If prompted, log into Salesforce (if not already logged in)
4. You'll see the Salesforce OAuth authorization screen

**Screenshot Guidance:** The authorization screen shows:
- Your Connected App name
- The permissions it's requesting
- "Allow" and "Deny" buttons

### 5.3: Authorize the Connection

1. Review the requested permissions
2. Click **Allow** to authorize the application
3. The popup window will close automatically
4. You'll be redirected back to your application

**What Happens Behind the Scenes:**
- Salesforce generates an authorization code
- Your application exchanges the code for access and refresh tokens
- Tokens are stored securely in your database
- The connection status updates to "Connected"

### 5.4: Verify Connection Status

1. Back in Settings → External Integrations
2. The Salesforce card should now show:
   - ✅ **Status: Connected** (green badge)
   - **Last Sync:** Never (until you trigger a sync)
   - **Connect** button changes to **Disconnect**
   - **Sync Now** and **Settings** buttons appear

---

## Step 6: Test the Connection

Always test your integration after connecting to ensure everything works.

### 6.1: Trigger a Test Sync

1. On the Salesforce card, click **Sync Now** button
2. A sync job will start in the background
3. You'll see a toast notification: "Sync initiated"
4. The card will show "Syncing..." status

### 6.2: Monitor Sync Progress

**Option A: Integration Health Dashboard**
1. Go to Settings → **Integration Health**
2. Find the "Salesforce" row
3. Check the **Last Sync** column - should show "In Progress" or a timestamp
4. Check the **Status** column - should show "Connected" or "Syncing"
5. Check the **Records Synced** column - should increment as data syncs

**Option B: Edge Function Logs**
1. Open Supabase Dashboard
2. Go to Edge Functions → `salesforce-sync`
3. Click **Logs** tab
4. You should see log entries showing sync activity
5. Look for successful responses (200 status codes)

**Direct Link:** [View Salesforce Sync Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/salesforce-sync/logs)

### 6.3: Verify Data in Database

After sync completes (may take 1-5 minutes depending on data size):

1. Go to **Accounts** page in your application
2. You should see Salesforce accounts appear
3. Check the **Data Source** column - should show "CRM" for Salesforce records
4. Click on an account to view details - data should match Salesforce

**Alternative - Check Database Directly:**
1. Open Supabase Dashboard → **Table Editor**
2. Select `accounts` table
3. Filter by `data_source = 'crm'`
4. You should see records with Salesforce data

### 6.4: Test Individual API Calls

For advanced testing, use the **Test Connection** feature:

1. Settings → External Integrations → Salesforce card
2. Click the **⋮** (three dots) menu
3. Select **Test Connection**
4. You'll see a test result dialog:
   - ✅ **Connection Status:** Success
   - **API Version:** v58.0 (or latest)
   - **Organization Name:** Your Salesforce org name
   - **Records Found:** Count of accounts available
5. Click **Close**

---

## Troubleshooting

### Issue 1: "Invalid client_id" Error

**Symptoms:**
- Error message: "invalid_client_id: client identifier invalid"
- Connection fails immediately after clicking "Allow"

**Causes:**
- Incorrect Consumer Key in Supabase secrets
- Copy/paste error (extra spaces, missing characters)

**Solution:**
1. Go to Salesforce → Setup → App Manager
2. Find your Connected App → Click **View**
3. Copy the **Consumer Key** again (use the Copy button)
4. Go to Supabase Dashboard → Edge Functions → Secrets
5. Find `SALESFORCE_CLIENT_ID` → Click **Edit**
6. Paste the Consumer Key again carefully
7. Click **Save**
8. Wait 2 minutes for changes to propagate
9. Try connecting again

### Issue 2: "redirect_uri_mismatch" Error

**Symptoms:**
- Error message: "redirect_uri_mismatch"
- OAuth authorization fails

**Causes:**
- Callback URL in Salesforce doesn't match the URL in your application
- Typo in callback URL
- Using `http://` instead of `https://`
- Extra trailing slash in URL

**Solution:**
1. Go to Salesforce → Setup → App Manager
2. Find your Connected App → Click **Edit**
3. Scroll to **Callback URL**
4. Verify it EXACTLY matches:
   ```
   https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
   ```
5. Check for:
   - ❌ NO trailing slash (`/` at end)
   - ✅ `https://` (not `http://`)
   - ✅ Correct project ID: `dhyfbaptcprxxixgnpby`
6. Click **Save**
7. Wait 5-10 minutes for Salesforce to propagate changes
8. Try connecting again

### Issue 3: "Insufficient Privileges" Error

**Symptoms:**
- Error message: "insufficient_privileges"
- Cannot access Salesforce data after connection

**Causes:**
- Your Salesforce user doesn't have API access enabled
- Profile lacks necessary permissions
- OAuth scopes are too restrictive

**Solution 1 - Enable API Access:**
1. Salesforce → Setup → Users → Find your user
2. Click **Edit**
3. Scroll down and check: ✅ **API Enabled**
4. Click **Save**

**Solution 2 - Check Profile Permissions:**
1. Salesforce → Setup → Profiles
2. Find your profile (e.g., "System Administrator")
3. Click **Edit**
4. Ensure these permissions are enabled:
   - ✅ API Enabled
   - ✅ View All Data (or at least "Read" on Accounts, Contacts, Leads)
5. Click **Save**

**Solution 3 - Add More OAuth Scopes:**
1. Salesforce → Setup → App Manager → Your Connected App → Edit
2. In **Selected OAuth Scopes**, add:
   - ✅ Full access (full)
3. Click **Save**
4. Disconnect and reconnect in your application

### Issue 4: Webhooks Not Received

**Symptoms:**
- Real-time updates from Salesforce don't appear in your app
- Settings → Webhook Activity shows no events

**Causes:**
- Salesforce Outbound Messages not configured
- Workflow rules not active
- Remote Site Settings blocking callbacks

**Solution:**
- Follow the [SALESFORCE_WEBHOOK_SETUP.md](./SALESFORCE_WEBHOOK_SETUP.md) guide
- Verify Workflow Rules are Active
- Check Outbound Message Delivery Status in Salesforce
- Add Remote Site Settings for your webhook endpoint

### Issue 5: Tokens Expire or "Authentication Failure" After Some Time

**Symptoms:**
- Connection works initially but fails after hours/days
- Error: "Session expired or invalid"

**Causes:**
- Refresh token not included in OAuth scopes
- Salesforce session policies too restrictive
- Refresh token not stored in database

**Solution:**
1. Salesforce → Setup → App Manager → Your Connected App → Edit
2. Verify **Selected OAuth Scopes** includes:
   - ✅ Perform requests on your behalf at any time (refresh_token, offline_access)
3. Verify **Refresh Token Policy** is set to:
   - "Refresh token is valid until revoked"
4. Click **Save**
5. Disconnect and reconnect in your application
6. Check if `refresh_token` is stored in database:
   ```sql
   SELECT credential_value->'refresh_token' 
   FROM integration_credentials 
   WHERE integration_id IN (
     SELECT id FROM integration_configs 
     WHERE provider_name = 'salesforce'
   );
   ```

### Issue 6: "Too Many Requests" or Rate Limit Errors

**Symptoms:**
- Sync fails with "REQUEST_LIMIT_EXCEEDED" error
- Can't connect or sync data

**Causes:**
- Exceeded Salesforce API daily limits
- Too many concurrent API calls

**Solution:**
1. Check your Salesforce API limits:
   - Setup → System Overview → API Usage
2. If at limit, options:
   - Wait until daily limit resets (midnight PST)
   - Upgrade Salesforce edition for more API calls
   - Reduce sync frequency (hourly → daily)
3. In your application:
   - Settings → External Integrations → Salesforce → Settings
   - Change **Sync Frequency** to "Daily" or "Weekly"
4. Consider using webhooks instead of polling (see SALESFORCE_WEBHOOK_SETUP.md)

### Issue 7: Data Not Syncing or Old Data

**Symptoms:**
- Accounts don't appear in application
- Data is outdated
- Sync says "Success" but no data

**Causes:**
- No accounts match your ICP filters
- Field mapping issues
- Data already exists (duplicate prevention)
- RLS policies blocking data access

**Solution 1 - Check ICP Filters:**
1. Go to **ICP Manager** page
2. Review your ICP definitions
3. Temporarily broaden filters (e.g., "All industries")
4. Trigger sync again

**Solution 2 - Check Field Mappings:**
1. Settings → External Integrations → Salesforce → **Field Mapping**
2. Verify mappings exist:
   - `Name` → `name`
   - `Website` → `domain`
   - `Industry` → `industry`
3. Click **Save Mappings**
4. Trigger sync again

**Solution 3 - Check for Duplicates:**
1. Database may prevent duplicates by domain
2. Run this query in Supabase SQL Editor:
   ```sql
   SELECT domain, COUNT(*) as count
   FROM accounts
   WHERE org_id = 'your-org-id'
   GROUP BY domain
   HAVING COUNT(*) > 1;
   ```
3. Use Settings → Data Mapping → **Merge Duplicates** tool

**Solution 4 - Check Edge Function Logs:**
1. [View Sync Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/salesforce-sync/logs)
2. Look for errors or warnings
3. Check if API calls return empty results

### Issue 8: "Failed to Store OAuth State" Error

**Symptoms:**
- Error when clicking "Connect" button
- OAuth flow doesn't start

**Causes:**
- Database issue (oauth_state table missing or RLS blocking)
- Edge function error

**Solution:**
1. Check if `oauth_state` table exists:
   ```sql
   SELECT * FROM oauth_state LIMIT 1;
   ```
2. If table missing, run migration:
   ```sql
   CREATE TABLE oauth_state (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     org_id uuid NOT NULL REFERENCES organizations(id),
     state_token text NOT NULL UNIQUE,
     provider text NOT NULL,
     redirect_url text,
     expires_at timestamptz NOT NULL,
     metadata jsonb,
     created_at timestamptz DEFAULT now()
   );
   ```
3. Check Edge Function logs for specific error
4. Verify user has org_id in user_profiles table

---

## Security Best Practices

### 1. Protect Your Consumer Secret

- ✅ **Store in Supabase Secrets** - Never hardcode in your application
- ✅ **Never commit to Git** - Use `.gitignore` for any local credential files
- ✅ **Rotate regularly** - Change secrets every 90-180 days
- ✅ **Limit access** - Only admins should view secrets in Supabase
- ❌ **Never share publicly** - Don't post in Slack, email, tickets

### 2. Restrict OAuth Scopes

Only request the minimum scopes needed:
- ✅ **Use `api` scope** for read/write access to data
- ✅ **Use `refresh_token`** for long-lived connections
- ❌ **Avoid `full` scope** unless absolutely necessary (gives complete access)

### 3. Configure IP Restrictions (Optional)

If your application has a static IP:
1. Salesforce → Setup → App Manager → Your Connected App → Edit
2. In **OAuth Policies**, set **IP Relaxation** to "Enforce IP restrictions"
3. Add your application's IP address to **IP Ranges**

### 4. Enable Authorization Logging

Track who authorizes your app:
1. Salesforce → Setup → **Security Controls** → **Session Settings**
2. Enable: ✅ **"Log all user sessions"**
3. Monitor under **Setup** → **Identity** → **Session Management**

### 5. Use Permission Sets (Advanced)

Instead of "All users may self-authorize", restrict to specific users:
1. Create a Permission Set for API access
2. Assign to specific users only
3. In Connected App settings, choose "Admin approved users are pre-authorized"
4. Assign the Permission Set to the Connected App

### 6. Monitor API Usage

Regularly check API consumption:
1. Salesforce → Setup → **System Overview**
2. Review **API Usage** - ensure you're not hitting limits
3. Set up alerts if approaching limits

### 7. Implement Token Refresh

Your application should automatically refresh tokens:
- Tokens expire after a set period (Salesforce default: varies by org)
- The `oauth-refresh` edge function handles this automatically
- Runs every 10 minutes via cron job
- Monitor: [View Token Refresh Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs)

---

## Testing Checklist

Use this checklist to ensure your Salesforce OAuth integration is fully functional.

### Pre-Connection Tests

- [ ] Salesforce admin access verified
- [ ] User has "API Enabled" permission
- [ ] Connected App created with correct callback URL
- [ ] OAuth scopes include `api` and `refresh_token`
- [ ] Waited 10 minutes after creating Connected App
- [ ] Consumer Key and Consumer Secret copied correctly
- [ ] Both secrets added to Supabase (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`)

### Connection Tests

- [ ] "Connect" button appears in application UI
- [ ] Clicking "Connect" opens Salesforce OAuth popup
- [ ] OAuth authorization screen shows correct app name
- [ ] Clicking "Allow" successfully authorizes
- [ ] Popup closes automatically after authorization
- [ ] Connection status changes to "Connected" in UI
- [ ] No error messages appear

### Data Sync Tests

- [ ] "Sync Now" button appears after connection
- [ ] Clicking "Sync Now" initiates sync
- [ ] Edge function logs show sync activity ([View Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/salesforce-sync/logs))
- [ ] Accounts appear in application's Accounts page
- [ ] Account data matches Salesforce (name, industry, domain, etc.)
- [ ] Contacts/Leads sync if configured
- [ ] "Last Sync" timestamp updates after sync
- [ ] No errors in Integration Health Dashboard

### Field Mapping Tests

- [ ] Field Mapping dialog opens (Settings → External Integrations → Salesforce → Field Mapping)
- [ ] Source fields from Salesforce are listed
- [ ] Target fields in database are listed
- [ ] Default mappings are correct (Name → name, Website → domain, etc.)
- [ ] Custom field mappings can be added
- [ ] Mappings save successfully
- [ ] Next sync uses new field mappings

### Token Refresh Tests

- [ ] `oauth-refresh` edge function exists
- [ ] Cron job is scheduled (run `SELECT * FROM cron.job WHERE jobname LIKE '%oauth%';`)
- [ ] Token refresh logs show successful refreshes ([View Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs))
- [ ] Connection remains active after 24 hours
- [ ] No "Authentication Failure" errors over time

### Webhook Tests (Optional - If Configured)

- [ ] Followed SALESFORCE_WEBHOOK_SETUP.md guide
- [ ] Outbound Messages or CDC configured in Salesforce
- [ ] Workflow Rules are Active
- [ ] Updated/created a test record in Salesforce
- [ ] Webhook event appears in Settings → Webhook Activity
- [ ] Account updates appear in application within seconds
- [ ] Webhook logs show successful processing

### Scheduled Sync Tests

- [ ] `CRON_SETUP.sql` script executed
- [ ] Cron job shows in database: `SELECT * FROM cron.job WHERE jobname = 'crm-auto-sync-hourly';`
- [ ] Sync runs automatically at scheduled interval
- [ ] Sync logs show hourly activity (if hourly sync)
- [ ] Sync frequency can be changed in UI (Settings → External Integrations → Salesforce → Settings)

### Error Handling Tests

- [ ] Test with invalid credentials - shows clear error message
- [ ] Test disconnect and reconnect - works smoothly
- [ ] Test with expired token - automatically refreshes
- [ ] Test with API limit reached - shows appropriate error
- [ ] Test with network issues - retries or shows error

### Security Tests

- [ ] Consumer Secret is hidden in Supabase Dashboard (shows •••••••)
- [ ] Secrets not visible in application UI
- [ ] Secrets not committed to Git repository
- [ ] OAuth state tokens expire after 5 minutes (check `oauth_state` table)
- [ ] Only authorized users can connect integrations (if restricted)

### Performance Tests

- [ ] Sync completes within reasonable time (< 5 minutes for < 1000 records)
- [ ] No timeout errors during sync
- [ ] Edge functions don't exceed execution time limits
- [ ] API rate limits not exceeded
- [ ] Large datasets (> 10,000 records) sync successfully (may take longer)

---

## Next Steps

After successfully setting up Salesforce OAuth:

1. **Set Up Real-Time Webhooks**
   - Follow [SALESFORCE_WEBHOOK_SETUP.md](./SALESFORCE_WEBHOOK_SETUP.md)
   - Get instant updates when Salesforce data changes

2. **Configure Scheduled Syncs**
   - Follow [CRON_SETUP_INSTRUCTIONS.md](./CRON_SETUP_INSTRUCTIONS.md)
   - Set up hourly/daily automated syncs

3. **Customize Field Mappings**
   - Follow [FIELD_MAPPING_GUIDE.md](./FIELD_MAPPING_GUIDE.md)
   - Map Salesforce custom fields to your schema

4. **Monitor Integration Health**
   - Go to Settings → Integration Health
   - Track sync status, errors, and data quality

5. **Set Up Enrichment Providers**
   - Add ZoomInfo, Apollo, Clearbit API keys
   - Enrich Salesforce data with external sources

---

## Support Resources

- **Edge Function Logs:** [View Salesforce Sync Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/salesforce-sync/logs)
- **OAuth Callback Logs:** [View OAuth Callback Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-callback/logs)
- **Token Refresh Logs:** [View Token Refresh Logs](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/oauth-refresh/logs)
- **Integration Health Dashboard:** Settings → Integration Health in your application
- **Salesforce API Limits:** Setup → System Overview in Salesforce
- **Troubleshooting Guide:** [TROUBLESHOOTING_INTEGRATIONS.md](./TROUBLESHOOTING_INTEGRATIONS.md)

---

## FAQ

**Q: How often should I sync data?**  
A: For most use cases, hourly syncs + webhooks provide the best balance. Use daily syncs if you have API limit concerns.

**Q: What happens if my Salesforce password changes?**  
A: OAuth tokens are independent of your password. The connection remains active even if you change your password.

**Q: Can multiple users from my organization connect to Salesforce?**  
A: Yes, if you set "All users may self-authorize" in the Connected App. Each user authorizes separately with their own credentials.

**Q: How do I disconnect Salesforce?**  
A: Go to Settings → External Integrations → Salesforce card → Click "Disconnect" → Confirm.

**Q: Can I connect to a Salesforce Sandbox?**  
A: Yes! Change the authorization URL in your Connected App from `login.salesforce.com` to `test.salesforce.com`.

**Q: What data is synced by default?**  
A: Accounts, Contacts, and Leads. You can customize field mappings to include/exclude specific fields.

**Q: How secure is OAuth compared to storing username/password?**  
A: OAuth is much more secure. Tokens can be revoked without changing passwords, have limited scopes, and can expire/refresh automatically.

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** ICP Scoring Platform Team
