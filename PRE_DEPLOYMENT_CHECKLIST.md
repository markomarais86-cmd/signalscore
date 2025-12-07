# Pre-Deployment Checklist

## ✅ Automated Fixes (Completed)

- [x] Health check endpoint made public (`/functions/v1/health-check`)
- [x] Performance indexes added to all key tables (30+ indexes)
- [x] Stuck enrichment jobs cleared
- [x] Historical failed_scores cleaned up
- [x] Clay webhook field mappings configured
- [x] Edge functions deployed and working

## 🔧 Manual Supabase Dashboard Actions Required

### 1. Enable Leaked Password Protection (HIGH PRIORITY)
**Time:** 2 minutes

1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Security" section
3. Enable **"Leaked Password Protection"**
4. Click Save

This prevents users from setting passwords that have been exposed in data breaches.

---

### 2. Reduce OTP Expiry Time (HIGH PRIORITY)
**Time:** 2 minutes

1. Go to Supabase Dashboard → Authentication → Settings
2. Find **"OTP Expiry"** setting
3. Change from **86400 seconds (24 hours)** to **3600 seconds (1 hour)**
4. Click Save

This reduces the window for OTP interception attacks.

---

### 3. Upgrade Postgres Version (MEDIUM PRIORITY)
**Time:** 30 minutes (scheduled maintenance)

1. Go to Supabase Dashboard → Settings → Infrastructure
2. Check available Postgres upgrades
3. Schedule upgrade during low-traffic period
4. Monitor for any issues after upgrade

---

## 🔑 Optional API Keys

### Sentry Error Monitoring (Recommended)
Add to Supabase secrets or `.env`:
```
VITE_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project-id]
```
Get from: https://sentry.io → Create project → Copy DSN

### ZoomInfo Integration (Optional)
```
ZOOMINFO_API_KEY=your_zoominfo_api_key
```

### Clearbit Integration (Optional)
```
CLEARBIT_API_KEY=your_clearbit_api_key
```

---

## ✅ Verified Working Integrations

| Integration | Status | Notes |
|-------------|--------|-------|
| Lovable Cloud | ✅ Connected | Edge functions deployed |
| Supabase | ✅ Connected | Database healthy |
| Apollo | ✅ Ready | API key configured |
| PDL (People Data Labs) | ✅ Ready | API key configured |
| OpenAI | ✅ Ready | API key configured |
| Resend | ✅ Ready | Email service ready |
| Clay | ✅ Ready | Webhooks configured |

---

## 📊 Current Database State

- **Accounts:** 14,360 (100% scored)
- **Leads:** 63,516
- **Organizations:** 2
- **ICP Profiles:** 1
- **Average Fit Score:** 72.2

---

## 🚀 Ready for Production

After completing the 3 manual dashboard actions above, the application is ready for production use.

### Health Check Endpoint
```
GET https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/health-check
```
Returns: `{"status":"healthy","timestamp":"...","checks":{...}}`

### Key Features Working
- ✅ Authentication (sign up, sign in, password reset)
- ✅ ICP scoring engine
- ✅ Campaign builder
- ✅ Executive dashboard
- ✅ Data enrichment pipeline
- ✅ CRM sync (Salesforce, HubSpot ready)
- ✅ Apollo/PDL contact discovery
- ✅ AI insights and recommendations

---

## 📅 Maintenance Schedule

- **Weekly Analytics Snapshot:** Mondays at 6:00 AM UTC
- **Webhook Retry Job:** Every 2 minutes (automated)
- **Score Refresh:** On-demand via dashboard

---

*Last Updated: December 7, 2024*
