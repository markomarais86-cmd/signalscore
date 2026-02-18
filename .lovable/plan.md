

## Fix: Apollo Sync Uses Wrong ICP for 91.Life (Child Org)

### Root Cause

When a super admin impersonates 91.Life, the Campaign Builder and Apollo Redemption Dialog both use `userProfile.org_id` (which is always the logged-in user's real org -- LaunchPulse). This means:

1. The **ICP loaded** for campaigns comes from LaunchPulse, not 91.Life
2. The **Apollo redemption request** is sent with LaunchPulse's org ID, so the edge function fetches LaunchPulse's ICP and stores leads under LaunchPulse

### What Changes

**File: `src/components/campaigns/CampaignBuilderV2.tsx`**

- Import `useEffectiveOrg` hook
- Replace all `userProfile.org_id` references with `effectiveOrgId` (approximately 6 locations):
  - `loadICP()` -- ICP query filter (line 107)
  - `useEffect` dependency for loading ICP (lines 85, 88)
  - `generateCampaignNames()` guard (line 147)
  - `optimizeSequence()` guard (line 164)
  - `estimateROI()` body payload (lines 181, 187)

**File: `src/components/campaigns/ApolloRedemptionDialog.tsx`**

- Import `useEffectiveOrg` hook
- Replace `userProfile.org_id` with `effectiveOrgId` in:
  - TAM mode request body `org_id` (line 275)
  - Standard mode request body `org_id` (line 282)
  - PDL fallback request body `org_id` (line 298)
  - Duplicate analysis query (wherever org_id is used)

### Why This Fixes It

```text
Current (broken):
  Admin impersonates 91.Life
  --> CampaignBuilder uses userProfile.org_id (LaunchPulse)
  --> Loads LaunchPulse ICP
  --> Sends LaunchPulse org_id to Apollo edge function
  --> Edge function uses LaunchPulse ICP criteria

Fixed:
  Admin impersonates 91.Life
  --> CampaignBuilder uses effectiveOrgId (91.Life)
  --> Loads 91.Life ICP (Healthcare/Hospital)
  --> Sends 91.Life org_id to Apollo edge function
  --> Edge function uses 91.Life ICP criteria
```

### Scope

Two files changed, approximately 12 lines updated. The edge function itself (`redeem-apollo-by-icp`) is correct -- it properly uses the `org_id` it receives to fetch the ICP. The bug is purely on the frontend passing the wrong org ID.
