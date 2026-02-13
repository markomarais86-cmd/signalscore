

# Fix Org Switcher: Wire All Pages to `useEffectiveOrg()`

## Problem
When you select "Night1" (or any org) in the org switcher, only 3 pages respond: Dashboard, Accounts, and Leads. The remaining pages (ICP Manager, Enrichment, Data Upload, Quick Enrich, AI Agents, API Access, Agent Tester, Settings) still use `userProfile.org_id` directly, so they always show LaunchPulse data.

## Solution
Replace `userProfile.org_id` with `effectiveOrgId` from `useEffectiveOrg()` in every affected page. This is a mechanical find-and-replace -- no logic changes, just swapping the data source so the org switcher actually controls what data loads.

## Pages to Update

| Page | File | Occurrences |
|------|------|-------------|
| ICP Manager | `src/pages/ICPManager.tsx` | 7 uses of `userProfile.org_id` |
| Enrichment | `src/pages/Enrichment.tsx` | 1 use |
| Data Upload | `src/pages/DataUpload.tsx` | 4 uses |
| Quick Enrich | `src/pages/QuickEnrich.tsx` | 4 uses |
| AI Agents | `src/pages/AIAgents.tsx` | 1 use |
| API Access | `src/pages/APIAccess.tsx` | 1 use |
| Agent Tester | `src/pages/AgentTester.tsx` | 1 use |
| Settings | `src/pages/Settings.tsx` | 4 uses |

## What Changes Per File

For each file above:
1. Add `import { useEffectiveOrg } from "@/hooks/use-effective-org";`
2. Add `const { effectiveOrgId } = useEffectiveOrg();` in the component
3. Replace every `userProfile.org_id` and `userProfile?.org_id` with `effectiveOrgId`
4. Update any guard conditions from `if (!userProfile?.org_id)` to `if (!effectiveOrgId)`
5. Update `useEffect` dependency arrays accordingly

## Technical Notes

- The `useEffectiveOrg` hook already exists and is used correctly in Dashboard, Accounts, and Leads
- For super admins, `effectiveOrgId` returns the selected org; for regular users, it returns their own `org_id` -- so behavior is unchanged for non-admins
- Settings page is a special case: org name display and team member list should also reflect the selected org when impersonating
- No database or edge function changes needed

