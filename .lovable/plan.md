
# GA4 Custom Dimensions Setup for A/B Testing

## Overview

Configure GA4 custom dimensions for `experiment_id` and `variant_id` to enable proper segmentation and analysis of A/B test results. This involves both GA4 Admin configuration (manual steps) and code updates to properly set dimensions.

---

## Current State

The codebase already tracks A/B experiments via the `trackABVariant()` function which sends:
- Event name: `ab_experiment_view`
- Event parameters: `experiment_id`, `variant_id`, `page_path`

However, these are only event-scoped parameters. To analyze user behavior across sessions by variant, we need **user-scoped custom dimensions**.

---

## Implementation Plan

### Part 1: GA4 Admin Configuration (Manual Steps)

You'll need to configure these in your GA4 property:

**Navigate to**: GA4 Admin → Custom definitions → Create custom dimensions

| Dimension Name | Scope | Event Parameter |
|----------------|-------|-----------------|
| Experiment ID | User | `experiment_id` |
| Variant ID | User | `variant_id` |
| Active Experiments | User | `active_experiments` |

This allows GA4 to:
- Track which variant each user was assigned
- Segment all user behavior by variant
- Compare conversion rates across variants

---

### Part 2: Code Changes

#### File 1: `src/lib/analytics.ts`

**Changes:**
1. Add a function to set user-scoped properties via `gtag('set')`
2. Update `trackABVariant()` to also set user properties
3. Add a helper to track all active experiments as a combined string

```typescript
// New function to set user-scoped custom dimensions
export const setABTestUserProperties = (
  experimentId: string,
  variantId: string
): void => {
  if (!isGAAvailable()) return;
  
  // Set as user properties (persisted across sessions)
  window.gtag?.('set', 'user_properties', {
    experiment_id: experimentId,
    variant_id: variantId,
    // Combined format for multi-experiment analysis
    active_experiments: `${experimentId}:${variantId}`,
  });
};

// Updated trackABVariant to also set user properties
export const trackABVariant = (
  experimentId: string,
  variantId: string,
  pagePath: string
): void => {
  if (!isGAAvailable()) return;
  
  // Set user-scoped properties for segmentation
  setABTestUserProperties(experimentId, variantId);
  
  // Track the event (for event-level analysis)
  window.gtag?.('event', 'ab_experiment_view', {
    experiment_id: experimentId,
    variant_id: variantId,
    page_path: pagePath,
  });
};
```

#### File 2: `src/lib/ab-testing.ts`

**Changes:**
1. Add localStorage tracking of all assigned experiments
2. Export function to get all user's experiment assignments

```typescript
const EXPERIMENTS_KEY = 'lp_ab_experiments';

// Track experiment assignment in localStorage
export const recordExperimentAssignment = (
  experimentId: string,
  variantId: string
): void => {
  const stored = localStorage.getItem(EXPERIMENTS_KEY);
  const experiments = stored ? JSON.parse(stored) : {};
  experiments[experimentId] = variantId;
  localStorage.setItem(EXPERIMENTS_KEY, JSON.stringify(experiments));
};

// Get all experiment assignments for the user
export const getAllExperimentAssignments = (): Record<string, string> => {
  const stored = localStorage.getItem(EXPERIMENTS_KEY);
  return stored ? JSON.parse(stored) : {};
};
```

#### File 3: `src/components/SEOHead.tsx`

**Changes:**
1. Import and call `recordExperimentAssignment` when variant is selected

```typescript
import { recordExperimentAssignment } from "@/lib/ab-testing";

// Inside useEffect for tracking
useEffect(() => {
  if (variantKey && experimentId) {
    recordExperimentAssignment(experimentId, variantKey);
    trackABVariant(experimentId, variantKey, canonicalPath);
  }
}, [variantKey, experimentId, canonicalPath]);
```

#### File 4: `src/hooks/usePageTracking.ts`

**Changes:**
1. On page load, restore and re-send all experiment assignments as user properties
2. This ensures GA4 has the user's variant info even on return visits

```typescript
import { getAllExperimentAssignments } from '@/lib/ab-testing';
import { setABTestUserProperties } from '@/lib/analytics';

export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
    
    // Restore experiment assignments on each page view
    const experiments = getAllExperimentAssignments();
    Object.entries(experiments).forEach(([expId, variantId]) => {
      setABTestUserProperties(expId, variantId);
    });
  }, [location]);
}
```

---

## GA4 Analysis Capabilities After Implementation

With custom dimensions configured, you'll be able to:

| Analysis | How |
|----------|-----|
| Compare conversion rates | Create segments by `variant_id`, compare Goal completions |
| Track engagement by variant | Filter any report by `experiment_id` |
| Build funnel comparisons | Use Explorations with variant dimension breakdown |
| Monitor experiment impact | Create custom dashboards showing variant performance |

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/analytics.ts` | Add `setABTestUserProperties()`, update `trackABVariant()` |
| `src/lib/ab-testing.ts` | Add experiment assignment tracking functions |
| `src/components/SEOHead.tsx` | Record assignments when variant selected |
| `src/hooks/usePageTracking.ts` | Restore user properties on page load |

---

## Post-Implementation: GA4 Setup Checklist

After code deployment, complete these steps in GA4 Admin:

1. Go to **Admin → Custom definitions → Custom dimensions**
2. Click **Create custom dimension**
3. Create these three dimensions:

| Display Name | Scope | Description | Event Parameter |
|--------------|-------|-------------|-----------------|
| Experiment ID | User | A/B test experiment identifier | experiment_id |
| Variant ID | User | Assigned variant for experiment | variant_id |
| Active Experiments | User | All experiment:variant pairs | active_experiments |

4. Wait 24-48 hours for data to populate
5. Verify in **Realtime** report → User properties
