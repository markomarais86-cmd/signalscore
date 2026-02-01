

# Improve Pricing Page Demo Request Emails

## Problem Summary

When someone clicks a pricing plan button, you receive a demo request email but it's not immediately clear which plan they selected:

| Current State | Issue |
|--------------|-------|
| Email subject: `New Demo Request from John` | No plan mentioned |
| Source field: `pricing-professional` | Buried at the bottom, cryptic format |

## Solution

Make the selected plan prominent and clear in both the email subject line and body.

### Changes

**1. Improve email subject to include the selected plan:**
```
Current:  "New Demo Request from John"
Improved: "New Demo Request: Professional Plan - John"
```

**2. Add a highlighted "Selected Plan" row at the top of the notification email:**

| Field | Value |
|-------|-------|
| **Selected Plan** | Professional (styled prominently) |
| Name | John Smith |
| Email | john@company.com |
| ... | ... |

**3. Parse the source to extract a clean plan name:**
```typescript
// Convert "pricing-professional" → "Professional Plan"
// Convert "pricing-growth-credit-pack" → "Growth Credit Pack"
const planName = parsePlanFromSource(data.source);
```

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/demo-request/index.ts` | Add plan parsing logic, update email subject, add highlighted plan row |

---

## Technical Details

### Plan Name Parsing Logic

```typescript
function getPlanDisplayName(source: string | undefined): string {
  if (!source) return "General Inquiry";
  
  // Handle pricing page sources: "pricing-professional" → "Professional Plan"
  if (source.startsWith('pricing-')) {
    const planPart = source.replace('pricing-', '');
    
    // Handle credit packs: "starter-credit-pack" → "Starter Credit Pack"
    if (planPart.includes('credit-pack')) {
      return planPart
        .replace('-credit-pack', '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + ' Credit Pack';
    }
    
    // Handle platform plans: "professional" → "Professional Plan"
    return planPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Plan';
  }
  
  return source; // Return as-is for other sources
}
```

### Updated Email Subject

```typescript
const planDisplayName = getPlanDisplayName(data.source);
const emailSubject = `New Demo Request: ${planDisplayName} - ${data.name}`;
```

### Updated Notification Email HTML

Add a highlighted row at the top:
```html
<tr style="background-color: #6366f1;">
  <td style="padding: 12px; border: 1px solid #ddd; color: white;">
    <strong>Selected Plan</strong>
  </td>
  <td style="padding: 12px; border: 1px solid #ddd; color: white; font-weight: bold;">
    Professional Plan
  </td>
</tr>
```

---

## Expected Outcome

After this fix:
1. Email subject will clearly show: **"New Demo Request: Professional Plan - John Smith"**
2. The selected plan will be highlighted at the top of the email body
3. You'll immediately know which pricing tier the prospect is interested in
4. Credit pack requests will also be clearly identified

