
# Expand Generic Email Prefix Filter

## Current State

The `GENERIC_EMAIL_PREFIXES` list in `provider-waterfall.ts` (lines 252-261) already includes many of the prefixes you mentioned:

**Already present:**
- `reception` (line 260)
- `bookings` (line 259)
- `reservations` (line 259)
- `orders` (line 259)
- `booking` (line 259)

## Recommended Additional Prefixes

To further improve accuracy, we can add these commonly used generic prefixes that are currently missing:

| Category | New Prefixes to Add |
|----------|---------------------|
| **Scheduling** | `appointments`, `scheduling`, `calendar` |
| **Support** | `tickets`, `techsupport`, `itsupport`, `customercare` |
| **Operations** | `dispatch`, `logistics`, `shipping`, `warehouse` |
| **Business** | `purchasing`, `procurement`, `vendor`, `partners` |
| **Communication** | `communications`, `pr`, `events`, `membership` |
| **Administrative** | `registrar`, `admissions`, `enrollment`, `records` |
| **Safety/Security** | `safety`, `security`, `emergency` |

---

## File to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/provider-waterfall.ts` | Add ~20 new generic email prefixes to the `GENERIC_EMAIL_PREFIXES` array (lines 252-261) |

---

## Implementation

Add these prefixes to the existing array, organized by category for maintainability:

```typescript
const GENERIC_EMAIL_PREFIXES = [
  // Existing prefixes...
  'info', 'contact', 'hello', 'hi', 'sales', 'support', 'admin', 
  'office', 'help', 'team', 'general', 'mail', 'email', 'enquiry',
  'inquiry', 'billing', 'accounts', 'service', 'customerservice',
  'feedback', 'press', 'media', 'marketing', 'hr', 'careers', 
  'jobs', 'legal', 'privacy', 'webmaster', 'noreply', 'no-reply',
  'donotreply', 'notifications', 'alerts', 'newsletter', 'subscribe',
  'orders', 'booking', 'bookings', 'reservations', 'helpdesk',
  'reception', 'frontdesk', 'compliance', 'finance', 'payroll',
  // NEW: Scheduling & Appointments
  'appointments', 'scheduling', 'calendar',
  // NEW: Extended Support
  'tickets', 'techsupport', 'itsupport', 'customercare',
  // NEW: Operations & Logistics
  'dispatch', 'logistics', 'shipping', 'warehouse', 'fulfillment',
  // NEW: Business & Partnerships
  'purchasing', 'procurement', 'vendor', 'vendors', 'partners',
  // NEW: Communications & Events
  'communications', 'pr', 'events', 'membership', 'members',
  // NEW: Administrative
  'registrar', 'admissions', 'enrollment', 'records',
  // NEW: Safety & Security
  'safety', 'security', 'emergency',
];
```

---

## Testing

After deployment, test with these email addresses to verify filtering:
- `appointments@company.com` - Should skip name extraction
- `dispatch@company.com` - Should skip name extraction
- `procurement@company.com` - Should skip name extraction
- `john@company.com` - Should still extract "John" as first name
