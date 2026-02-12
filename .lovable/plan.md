

# Step 3 Completion: Wire Server-Side Conversion Events

The `push-conversion-event` edge function already exists with full GA4, Meta CAPI, and LinkedIn CAPI support. What's missing are the **integration points** and the **admin settings UI**.

---

## Changes

### 1. Wire `demo-request` to push a "Lead" conversion event
After successfully saving a marketing lead, call `push-conversion-event` with the lead's email, click IDs, UTM data, and event name "Lead".

**File**: `supabase/functions/demo-request/index.ts`
- After the lead is saved (line ~153), add a non-fatal call to `push-conversion-event` passing email, click_ids, utm_source, utm_campaign, and org_id.

### 2. Wire `route-lead` to push a "QualifiedLead" conversion event
After tier assignment and routing, fire a conversion event so ad platforms know a lead was qualified.

**File**: `supabase/functions/route-lead/index.ts`
- After the alert is sent (line ~214), add a non-fatal call to `push-conversion-event` with event_name based on tier (e.g., "QualifiedLead" for P1/P2, skipped for P3).

### 3. Create Ad Platform API Settings UI
A new settings component where admins can view/manage the 6 required secrets: `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `LINKEDIN_CAPI_TOKEN`, `LINKEDIN_AD_ACCOUNT_ID`.

**New file**: `src/components/settings/AdPlatformAPISettings.tsx`
- Card-based UI with sections for GA4, Meta, and LinkedIn
- Each section shows credential fields (masked) with status indicators
- Instructions on where to obtain each credential
- Test connection button that calls `push-conversion-event` with a test event

**Modified file**: `src/pages/Settings.tsx`
- Add lazy import for `AdPlatformAPISettings`
- Add it to the Integrations tab content

---

## Technical Details

### demo-request addition (after line 183)
```typescript
// Push "Lead" conversion event (non-fatal)
try {
  await fetch(`${supabaseUrl}/functions/v1/push-conversion-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      event_name: "Lead",
      lead_id: savedLead.id,
      email: data.email,
      click_ids: data.click_ids || {},
      utm_source: data.utm_source,
      utm_campaign: data.utm_campaign,
      org_id: savedLead.org_id,
    }),
  });
} catch (convErr) {
  console.error("Conversion push failed (non-fatal):", convErr);
}
```

### route-lead addition (after line 214)
```typescript
// Push conversion event for qualified leads
if (tierConfig.tier !== "P3") {
  try {
    await fetch(`${supabaseUrl}/functions/v1/push-conversion-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        event_name: "QualifiedLead",
        lead_id: lead_id,
        email: lead.email,
        org_id: org_id,
      }),
    });
  } catch (convErr) {
    console.error("Conversion push failed (non-fatal):", convErr);
  }
}
```

### AdPlatformAPISettings.tsx
- 3 collapsible sections: Google Analytics 4, Meta (Facebook), LinkedIn
- Each section lists the required credentials with descriptions
- Status badges (Configured / Not Set) based on whether the secret exists
- Links to where each credential can be obtained (GA4 Admin > Data Streams, Meta Events Manager, LinkedIn Campaign Manager)
- "Test Connection" button per platform

### Settings.tsx changes
- Add lazy import for `AdPlatformAPISettings`
- Place it inside the existing Integrations tab

