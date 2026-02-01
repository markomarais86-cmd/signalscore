

# Fix Admin Organization Management - Save, Deactivate, and Delete

## Problem Summary

The organization management dialog fails to save changes with the error:
```
"invalid input syntax for type uuid: \"free\""
```

**Root Cause:** The `organizations.plan_id` column is a **UUID** that references the `plan_limits` table. But the code is trying to save string values like `'free'`, `'enterprise'` instead of the actual UUID from `plan_limits`.

| What's happening | What should happen |
|------------------|-------------------|
| Saving `plan_id: 'enterprise'` (string) | Should save `plan_id: '4a2e8e92-6801-4bf9-b35f-01c20ed84a89'` (UUID) |

The `plan_limits` table has UUIDs mapped to plan names:
- `free` → `9d176a2d-d4cd-482a-b7c5-ba104e7d1db0`
- `pilot` → `90cc86c5-d3fc-446e-97ee-ac9afca4ebdc`
- `professional` → `adfb7b99-4f2b-4f3c-a2ea-7b2f6e2f836c`
- `growth` → `94e94bab-d831-47f6-9a46-bc1c9182cc3d`
- `enterprise` → `4a2e8e92-6801-4bf9-b35f-01c20ed84a89`

---

## Solution

### Step 1: Create a Plan ID Mapping Utility

Add a mapping between plan tier names and their database UUIDs in `src/lib/plan-tiers.ts`:

```typescript
// Add UUID mapping for database plan_limits table
export const PLAN_TIER_UUID_MAP: Record<PlanTier, string> = {
  free: '9d176a2d-d4cd-482a-b7c5-ba104e7d1db0',
  pilot: '90cc86c5-d3fc-446e-97ee-ac9afca4ebdc',
  professional: 'adfb7b99-4f2b-4f3c-a2ea-7b2f6e2f836c',
  growth: '94e94bab-d831-47f6-9a46-bc1c9182cc3d',
  enterprise: '4a2e8e92-6801-4bf9-b35f-01c20ed84a89',
};

// Reverse lookup: UUID to plan tier name
export const UUID_TO_PLAN_TIER: Record<string, PlanTier> = {
  '9d176a2d-d4cd-482a-b7c5-ba104e7d1db0': 'free',
  '90cc86c5-d3fc-446e-97ee-ac9afca4ebdc': 'pilot',
  'adfb7b99-4f2b-4f3c-a2ea-7b2f6e2f836c': 'professional',
  '94e94bab-d831-47f6-9a46-bc1c9182cc3d': 'growth',
  '4a2e8e92-6801-4bf9-b35f-01c20ed84a89': 'enterprise',
};

// Helper functions
export function getPlanUuid(planTier: PlanTier): string {
  return PLAN_TIER_UUID_MAP[planTier];
}

export function getPlanTierFromUuid(uuid: string | null): PlanTier {
  if (!uuid) return 'free';
  return UUID_TO_PLAN_TIER[uuid] ?? 'free';
}
```

### Step 2: Fix OrganizationManagementDialog

Update `src/components/platform-admin/OrganizationManagementDialog.tsx`:

**2a. Import the new helper functions:**
```typescript
import { 
  PLAN_TIER_LIST, 
  getPlanTierFromId, 
  getPlanUuid, 
  getPlanTierFromUuid,
  type PlanTier 
} from "@/lib/plan-tiers";
```

**2b. Fix state initialization to convert UUID to tier name:**
```typescript
// Current (wrong - treats UUID as tier name)
const [planId, setPlanId] = useState<PlanTier>(org?.plan_id as PlanTier || 'free');

// Fixed - convert UUID to tier name for display
const [planTier, setPlanTier] = useState<PlanTier>(
  getPlanTierFromUuid(org?.plan_id) || 'free'
);
```

**2c. Fix useEffect to convert UUID properly:**
```typescript
useEffect(() => {
  if (org) {
    setStatus(org.status || 'active');
    setPlanTier(getPlanTierFromUuid(org.plan_id) || 'free'); // Convert UUID to tier
    setCreditLimit(org.enrichment_credits_total || 1000);
  }
}, [org]);
```

**2d. Fix handleSave to convert tier name back to UUID:**
```typescript
const handleSave = async () => {
  if (!org) return;
  
  setLoading(true);
  try {
    const { error } = await supabase
      .from("organizations")
      .update({
        status,
        plan_id: getPlanUuid(planTier), // Convert tier name to UUID
        enrichment_credits_total: creditLimit
      })
      .eq("id", org.id);

    if (error) throw error;
    // ... rest unchanged
  }
};
```

### Step 3: Fix usePlatformAdmin Hook

Update `src/hooks/use-platform-admin.tsx` to convert UUIDs when fetching:

```typescript
import { getPlanTierFromUuid } from "@/lib/plan-tiers";

// In the metrics mapping, convert plan_id UUID to tier name for display
return {
  id: org.id,
  name: org.name,
  status: org.status,
  plan_id: org.plan_id, // Keep as UUID for database operations
  // For display, use getPlanTierFromUuid(org.plan_id) in the UI
  // ...
};
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/plan-tiers.ts` | Add UUID mapping and helper functions |
| `src/components/platform-admin/OrganizationManagementDialog.tsx` | Use UUID conversion when saving and loading |
| `src/hooks/use-platform-admin.tsx` | No changes needed (keeps raw UUID) |

### Regarding Deactivate/Delete

The deactivate and delete functions use RPC calls that already exist in the database:
- `activate_organization(org_id_param)` 
- `deactivate_organization(org_id_param)` 

These should work once we verify RLS policies allow super_admin to execute them. The same fix for plan_id will also help ensure these operations complete successfully since they may have been affected by prior failed saves corrupting the transaction.

---

## Expected Outcome

After this fix:
1. Opening the management dialog will correctly show the current plan (e.g., "Free" instead of showing UUID)
2. Changing the plan and clicking "Save Changes" will successfully update the database
3. A success toast will appear and the dialog will close
4. Refreshing will show the updated plan
5. Deactivate/Delete operations will work as expected

