# Integration Management Testing Checklist

This comprehensive testing checklist ensures that Phase 2 Integration Management features work correctly across all scenarios.

## Pre-Testing Setup

- [ ] Database migration applied successfully (`integration_configs`, `integration_credentials`, `integration_sync_logs`, `oauth_state` tables created)
- [ ] Edge function `integration-service` deployed and accessible
- [ ] Test user account created with valid `org_id`
- [ ] Browser developer tools open (Network + Console tabs)
- [ ] Test environment configured (staging/development)

---

## Component Testing

### A. IntegrationCredentialManager Component

**Location:** Settings → Data & Integrations → Integration Credentials

#### 1. Visual Verification
- [ ] Four provider cards visible (ZoomInfo, Apollo, Clearbit, PDL)
- [ ] Each card shows provider logo/icon
- [ ] Each card has description text
- [ ] "How to get API key" documentation link present
- [ ] Cards are responsive on mobile devices

#### 2. API Key Input
- [ ] Password input field present (dots shown by default)
- [ ] Eye icon toggles visibility (show/hide key)
- [ ] Key remains masked after show/hide toggle
- [ ] Input accepts long API keys (100+ chars)
- [ ] Copy-paste works correctly
- [ ] Keyboard navigation works (Tab, Enter)

#### 3. Test Connection Button
- [ ] Button disabled when input empty
- [ ] Button shows loading spinner during test
- [ ] **Success:** Green checkmark appears
- [ ] **Success:** Toast notification shows "Connection Successful"
- [ ] **Error:** Red X appears
- [ ] **Error:** Toast shows specific error message ("Invalid API key", "Rate limit exceeded", etc.)
- [ ] Status persists after page refresh
- [ ] Multiple rapid clicks handled gracefully

#### 4. Save Functionality
- [ ] Save button disabled when input empty
- [ ] Save button shows loading spinner
- [ ] **Success:** Toast shows "API key saved securely"
- [ ] Database record created (verify in Supabase dashboard)
- [ ] API key encrypted in database (not plaintext)
- [ ] After save, only last 4 chars visible (e.g., "****xyz")
- [ ] `key_prefix` field populated correctly
- [ ] Audit log entry created

#### 5. Error Scenarios
- [ ] Invalid API key: Shows "Invalid API key for [provider]" message
- [ ] Network error: Shows "Network error, please try again" message
- [ ] Duplicate save: Updates existing record (no duplicate entry)
- [ ] Empty key: Shows validation error
- [ ] Server error (500): Shows user-friendly error message
- [ ] Timeout: Shows timeout error after 30 seconds

---

### B. IntegrationHealthDashboard Component

**Location:** Settings → Data & Integrations → Integration Health

#### 1. Empty State
- [ ] Shows "No active integrations" message
- [ ] Shows activity icon placeholder
- [ ] Suggests "Configure integrations to see health status"
- [ ] Provides link to Integration Credentials section

#### 2. With Integrations
- [ ] Shows health summary (e.g., "3/5 Integrations Healthy")
- [ ] Visual health indicators (●●●○○)
- [ ] Color-coded: Green (healthy), Yellow (warning), Red (error), Blue (syncing)
- [ ] Lists all configured integrations

#### 3. Per-Integration Display
- [ ] Provider name capitalized correctly (e.g., "ZoomInfo", not "zoominfo")
- [ ] Status badge with correct color:
  - **Green:** "Healthy" (status = `connected`)
  - **Yellow:** "Warning" (status = `connected` but `error_count > 0`)
  - **Red:** "Error" (status = `error`)
  - **Blue:** "Syncing" (status = `syncing`)
- [ ] Last sync time in human format ("2m ago", "1h ago", "Never")
- [ ] Error message visible if status = `error` (e.g., "Invalid API key")
- [ ] Sync count displayed (e.g., "142 records synced")

#### 4. Real-Time Updates (Supabase Realtime)
- [ ] Open Settings in two browser tabs
- [ ] **Tab 1:** Connect new integration
- [ ] **Tab 2:** Health dashboard updates **without refresh**
- [ ] Status changes reflect in real-time (`syncing` → `connected`)
- [ ] New integrations appear instantly in Tab 2
- [ ] Disconnected integrations disappear in real-time

#### 5. Loading State
- [ ] Shows skeleton placeholders while loading (3-5 rows)
- [ ] Smooth transition to actual data (no flicker)
- [ ] Loading state shows for < 2 seconds

#### 6. Error State
- [ ] If API call fails, shows "Failed to load integrations" message
- [ ] Provides "Retry" button
- [ ] Retry button works and fetches data again

---

## Edge Function Testing

### A. Manual API Testing (via curl or Postman)

#### Get Auth Token
```typescript
// In browser console or React component
const { data: { session } } = await supabase.auth.getSession();
const token = session.access_token;
console.log('Token:', token);
```

#### Test Endpoints

##### 1. List Integrations
```bash
curl -X GET 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/integration-service?action=list' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "integrations": [
    {
      "id": "uuid",
      "provider_name": "zoominfo",
      "status": "connected",
      "last_sync_at": "2025-01-29T10:30:00Z",
      "recentLogs": [...]
    }
  ]
}
```

**Checklist:**
- [ ] Returns 200 status
- [ ] Returns JSON array of integrations
- [ ] Only shows current org's integrations (cross-org isolation)
- [ ] Includes recent sync logs (last 5)
- [ ] Missing/invalid token returns 401

##### 2. Test Connection
```bash
curl -X POST 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/integration-service?action=test' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_name": "zoominfo", "api_key": "test_key_12345"}'
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "provider": "zoominfo"
}
```

**Expected Error Response:**
```json
{
  "success": false,
  "error": "Invalid API key for ZoomInfo"
}
```

**Checklist:**
- [ ] Returns test result within 5 seconds
- [ ] Invalid key returns `success: false`
- [ ] Valid key returns `success: true`
- [ ] Error messages are provider-specific
- [ ] Network errors handled gracefully

##### 3. Connect Integration
```bash
curl -X POST 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/integration-service?action=connect' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_name": "zoominfo",
    "integration_type": "data_enrichment",
    "api_key": "test_key_12345"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "config_id": "uuid-of-config",
  "credential_id": "uuid-of-credential"
}
```

**Checklist:**
- [ ] Creates `integration_configs` record
- [ ] Creates `integration_credentials` record
- [ ] Returns `config_id` and `credential_id`
- [ ] Duplicate provider updates existing config (no error)
- [ ] Audit log entry created

##### 4. Disconnect Integration
```bash
curl -X POST 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/integration-service?action=disconnect' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_name": "zoominfo"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Integration disconnected successfully"
}
```

**Checklist:**
- [ ] Sets `status = 'disconnected'`
- [ ] Credentials remain in database (not deleted)
- [ ] Audit log entry created
- [ ] Returns 404 if integration doesn't exist

##### 5. Trigger Sync
```bash
curl -X POST 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/integration-service?action=sync' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_name": "zoominfo"}'
```

**Expected Response:**
```json
{
  "success": true,
  "sync_log_id": "uuid"
}
```

**Checklist:**
- [ ] Creates `integration_sync_logs` entry
- [ ] Status changes to `syncing`
- [ ] Eventually completes (check after 5 seconds)
- [ ] Updates `last_sync_at` timestamp
- [ ] `duration_ms` calculated correctly

---

## Database Verification

### Check `integration_configs` Table
```sql
SELECT * FROM integration_configs WHERE org_id = 'YOUR_ORG_ID';
```

**Checklist:**
- [ ] Record created with correct `provider_name`
- [ ] `org_id` matches user's organization
- [ ] `status` is `connected` or `error`
- [ ] `created_at` and `updated_at` timestamps set
- [ ] `config` JSON field stores provider-specific settings
- [ ] Unique constraint enforced (`org_id`, `provider_name`)

### Check `integration_credentials` Table
```sql
SELECT * FROM integration_credentials WHERE org_id = 'YOUR_ORG_ID';
```

**Checklist:**
- [ ] API key stored (encrypted in production)
- [ ] `key_prefix` shows first 4 and last 4 chars (e.g., "abcd****xyz")
- [ ] `org_id` matches user's org
- [ ] `integration_config_id` references correct config
- [ ] `credential_type` is `api_key` or `oauth_token`
- [ ] `expires_at` set for OAuth tokens (NULL for API keys)

### Check `integration_sync_logs` Table
```sql
SELECT * FROM integration_sync_logs 
WHERE org_id = 'YOUR_ORG_ID' 
ORDER BY started_at DESC 
LIMIT 10;
```

**Checklist:**
- [ ] Sync log created after triggering sync
- [ ] `status` progresses: `started` → `completed` or `failed`
- [ ] `duration_ms` tracked (e.g., 3240 ms)
- [ ] `records_processed`, `records_created`, `records_updated` counts present
- [ ] `error_message` populated if `status = 'failed'`
- [ ] `completed_at` timestamp set when done

### Check `audit_logs` Table
```sql
SELECT * FROM audit_logs 
WHERE action LIKE 'integration_%' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Checklist:**
- [ ] Connection logged (`integration_connected`)
- [ ] Disconnection logged (`integration_disconnected`)
- [ ] Status changes logged (`integration_status_changed`)
- [ ] `actor` field shows user ID or `system`
- [ ] `org_id` correct
- [ ] `meta` JSON contains provider details

---

## Cross-Org Security Testing

### Setup
1. **Create two test organizations:**
   - Org A: "Test Company A"
   - Org B: "Test Company B"

2. **Create users in each org:**
   - User A: `usera@test.com` (belongs to Org A)
   - User B: `userb@test.com` (belongs to Org B)

3. **Connect integrations:**
   - Org A: Connect ZoomInfo
   - Org B: Connect Apollo

### Test Isolation

#### Test 1: List Integrations
- [ ] Log in as User A
- [ ] List integrations → Only ZoomInfo visible
- [ ] Log in as User B
- [ ] List integrations → Only Apollo visible
- [ ] **CRITICAL:** User B **cannot** see Org A's ZoomInfo config

#### Test 2: Access Other Org's Config ID
```bash
# Get Org A's config_id from database
# Try to access it as User B
curl -X POST 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/integration-service?action=status' \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_name": "zoominfo"}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Integration not found"
}
```

**Checklist:**
- [ ] User B gets 404 or `Integration not found` error
- [ ] User B **cannot** disconnect Org A's integration
- [ ] User B **cannot** trigger sync for Org A's integration

#### Test 3: RLS Policy Verification (Direct Database Query)
```sql
-- Query with service role (bypasses RLS)
SELECT * FROM integration_configs;
-- Should return configs from both orgs

-- Query with User A's JWT (RLS enforced)
SET request.jwt.claim.sub = 'USER_A_ID';
SELECT * FROM integration_configs;
-- Should return ONLY Org A's configs
```

**Checklist:**
- [ ] Service role sees all configs
- [ ] User A's JWT sees only Org A's configs
- [ ] User B's JWT sees only Org B's configs
- [ ] RLS policies correctly filter by `org_id`

---

## Error Handling Testing

### 1. Network Errors
- [ ] Disconnect internet mid-request
- [ ] Error message: "Network error. Please check your connection."
- [ ] UI doesn't crash (error boundary works)
- [ ] Retry button appears and works

### 2. Invalid API Keys
- [ ] Enter random string as API key (e.g., "invalid_key_123")
- [ ] Test connection
- [ ] Error message: "Invalid API key for [Provider]"
- [ ] Status set to `error` in database
- [ ] Error count incremented

### 3. Rate Limiting
- [ ] Make 10+ rapid test requests (use a script)
- [ ] After limit (e.g., 100 requests/minute), receive rate limit error
- [ ] Error message: "Rate limit exceeded. Please try again in X seconds."
- [ ] UI shows friendly message, not technical error
- [ ] Rate limit resets after window expires

### 4. Expired OAuth Tokens (Future)
- [ ] Mock expired token (set `expires_at` to past date)
- [ ] Trigger sync
- [ ] Error message: "OAuth token expired. Please reconnect."
- [ ] Status set to `error`
- [ ] Provides "Reconnect" button

### 5. Server Errors (500)
- [ ] Mock server error (e.g., temporarily break edge function)
- [ ] Error message: "Server error. Our team has been notified."
- [ ] UI doesn't crash
- [ ] Provides "Contact Support" link

---

## Performance Testing

### 1. Load Time
- [ ] Settings page loads in < 2 seconds (cold start)
- [ ] Integration list loads in < 1 second
- [ ] Health dashboard renders instantly (< 500ms)

### 2. Large Data Sets
- [ ] Create 10+ integrations
- [ ] List still loads quickly (< 2 seconds)
- [ ] No UI lag when scrolling
- [ ] Pagination works correctly (if implemented)

### 3. Real-Time Updates Performance
- [ ] Trigger sync
- [ ] Status updates within 1 second (via Realtime)
- [ ] No page refresh needed
- [ ] Multiple simultaneous syncs handled correctly

### 4. Concurrent Users
- [ ] 5 users connect integrations simultaneously
- [ ] No race conditions
- [ ] Database handles concurrent writes
- [ ] No deadlocks

---

## Browser Compatibility

Test in the following browsers:
- [ ] **Chrome** (latest version)
- [ ] **Firefox** (latest version)
- [ ] **Safari** (latest version)
- [ ] **Edge** (latest version)
- [ ] **Mobile Safari** (iOS)
- [ ] **Mobile Chrome** (Android)

### Per-Browser Checklist:
- [ ] Integration cards render correctly
- [ ] API key show/hide toggle works
- [ ] Toast notifications appear
- [ ] Real-time updates work
- [ ] No console errors

---

## Accessibility Testing

### 1. Keyboard Navigation
- [ ] Tab key navigates through all interactive elements
- [ ] Enter key activates buttons
- [ ] Escape key closes modals/dropdowns
- [ ] Focus indicators visible

### 2. Screen Reader Compatibility
- [ ] Form inputs have proper labels (`<label>` or `aria-label`)
- [ ] Error messages announced to screen readers (`aria-live="polite"`)
- [ ] Status updates announced (e.g., "Integration connected")
- [ ] Buttons have descriptive labels (not just icons)

### 3. Color Contrast
- [ ] Text meets WCAG AA standards (4.5:1 for normal text)
- [ ] Status indicators distinguishable for colorblind users
- [ ] Error messages have sufficient contrast

### 4. Responsive Design
- [ ] Works on mobile (320px width)
- [ ] Works on tablet (768px width)
- [ ] Works on desktop (1920px width)
- [ ] No horizontal scrolling

---

## Edge Cases

### 1. Concurrent Updates
- [ ] Two users update same integration simultaneously
- [ ] Last write wins (no data corruption)
- [ ] Audit logs show both actions
- [ ] No database constraint violations

### 2. Long API Keys
- [ ] Test with 200+ character API key
- [ ] Input accepts full key
- [ ] Storage works correctly (no truncation)
- [ ] Display truncates gracefully (shows "****xyz")

### 3. Special Characters in API Keys
- [ ] API key with special chars (`!@#$%^&*`)
- [ ] Properly encoded in HTTP requests
- [ ] Properly stored in database (no SQL injection)
- [ ] Properly displayed in UI (no XSS)

### 4. Empty/Null Values
- [ ] Handle missing `provider_name` gracefully
- [ ] Handle null `config` values (use default `{}`)
- [ ] Handle empty sync logs array
- [ ] No JavaScript errors

### 5. Deleted Organizations
- [ ] Delete organization
- [ ] All integrations cascade deleted (`ON DELETE CASCADE`)
- [ ] No orphaned credentials
- [ ] No orphaned sync logs

---

## Regression Testing

After any code changes, re-test:
- [ ] Basic connection flow (ZoomInfo)
- [ ] Test connection functionality
- [ ] Health dashboard displays correctly
- [ ] Real-time updates still work
- [ ] Database records created correctly
- [ ] Cross-org isolation works
- [ ] Error handling works

---

## OAuth Testing (Phase 2 Enhanced - Future)

### 1. Salesforce OAuth Flow
- [ ] Click "Connect Salesforce"
- [ ] Redirected to Salesforce login
- [ ] Grant permissions
- [ ] Redirected back to app
- [ ] Success toast shown
- [ ] Integration status shows "Connected"
- [ ] Token stored in database (encrypted)
- [ ] Audit log entry created

### 2. HubSpot OAuth Flow
- [ ] Click "Connect HubSpot"
- [ ] Redirected to HubSpot
- [ ] Select account
- [ ] Grant permissions
- [ ] Redirected back
- [ ] Integration active

### 3. Token Refresh
- [ ] Wait for token to expire (or mock expiry)
- [ ] Trigger sync operation
- [ ] Token auto-refreshed
- [ ] Sync completes successfully
- [ ] No user intervention required

### 4. OAuth Error Scenarios
- [ ] **User denies permission:** Shows "Permission denied" error
- [ ] **Network error during exchange:** Shows network error
- [ ] **Invalid state token:** Shows security error
- [ ] **Expired state token:** Shows "OAuth flow expired, please try again"

### 5. OAuth Security
- [ ] State token used only once (deleted after use)
- [ ] Tokens encrypted in database (not plaintext)
- [ ] Cross-org isolation works (can't hijack OAuth flow)
- [ ] Audit logs created for OAuth connections

---

## Success Criteria

Phase 2 Integration Management is complete when:

✅ **Database:** All 4 tables created with RLS policies  
✅ **Edge Function:** `integration-service` handles all actions  
✅ **UI Components:** Credential manager and health dashboard functional  
✅ **Real-Time:** Supabase Realtime updates work  
✅ **Security:** Cross-org isolation enforced  
✅ **Testing:** All checklists pass (100+ checkpoints)  
✅ **Documentation:** This checklist completed  

---

## Notes

- **Date Tested:** _____________
- **Tested By:** _____________
- **Environment:** [ ] Development [ ] Staging [ ] Production
- **Issues Found:** _____________
- **Passed:** _____ / _____ tests

---

**Troubleshooting Tips:**
- If real-time updates don't work, check Supabase Realtime is enabled for tables
- If cross-org isolation fails, verify RLS policies reference `get_current_user_org_id()`
- If OAuth fails, check redirect URIs match exactly
- If edge function times out, increase timeout limit in `supabase/config.toml`

**Contact:** [Your Support Email]
