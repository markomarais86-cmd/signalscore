

# Fix: ICP Wizard -- Keywords, Titles, Verticals, and Save Issues

## Issues Found

### 1. ICP Save Uses Wrong Org (Root Cause of "Nothing Happens on Update")
`ICPWizard.tsx` line 238 uses `userProfile.org_id` (Launchpulse) instead of `effectiveOrgId` (91.Life). When you click Update, the ICP gets saved to the wrong org, so it "disappears" from the 91.Life view.

**Fix:** Import `useEffectiveOrg` and use `effectiveOrgId` in `handleSave`.

### 2. Industries: Add Company Keywords Field
Currently the industry section only offers a fixed dropdown of predefined industries/sub-industries. There is no way to add free-text company keywords (e.g., "electrophysiology", "remote patient monitoring") that would match against `industry_raw`, `industry_norm`, or company descriptions.

**Fix:** Add a "Company Keywords" free-text input field (type and press Enter) to Step 2 alongside industries/sub-industries. This will be stored in a new `company_keywords` array field on the ICP. The scoring engine already does ILIKE fuzzy matching, so these keywords will expand the match scope beyond the fixed taxonomy.

### 3. Job Titles: Remove Management Level Prefixes
The ICP currently has combined titles like "Service Line Director Cardiology", "Division Chief Electrophysiology", "System VP of Finance". The seniority/management level is already handled separately via `persona_seniority_levels`. Titles should be pure functional keywords like "Cardiology", "Electrophysiology", "Finance", "Revenue Cycle" -- except for C-level titles (CFO, CIO, CISO, CEO, CMO) which are inherently title + seniority combined.

**Fix:** 
- Clean up the existing ICP data to strip management-level prefixes from titles
- Update the wizard's placeholder text and tips to guide users: "Enter functional keywords only (e.g., Cardiology, Revenue Cycle). Seniority levels like VP, Director are set separately above."

### 4. Vertical Attributes Not Showing ("The Bids")
The Vertical Attributes card in Step 2 queries `custom_attribute_definitions` with `org_id = userProfile.org_id` (Launchpulse), but the ICP is now under 91.Life. The custom attributes (facility_type, bed_count, EHR system, specialties, CMS star rating) are defined under Launchpulse's org_id.

Two things need fixing:
- The query in Step 2 must use `effectiveOrgId` instead of `userProfile.org_id`
- The custom attribute definitions need to be copied/shared to the 91.Life org (or the existing definitions need their `org_id` updated)

**Fix:** 
- Update Step 2 query to use `effectiveOrgId`
- Copy custom attribute definitions to 91.Life org via SQL

### 5. Step 3 and Match Count Also Use Wrong Org
`ICPWizardStep3.tsx` queries lead titles using `userProfile.org_id`. The match count RPC in Step 2 also uses `userProfile.org_id`. Both need `effectiveOrgId`.

## Technical Changes

### File 1: `src/components/icp/ICPWizard.tsx`
- Import `useEffectiveOrg` from `@/hooks/use-effective-org`
- Replace `userProfile.org_id` with `effectiveOrgId` in `handleSave` (line 238)
- Also update the guard check on line 233

### File 2: `src/components/icp/ICPWizardStep2.tsx`
- Import `useEffectiveOrg`
- Replace all `userProfile.org_id` references with `effectiveOrgId` (lines 30-71)
- Add a new "Company Keywords" card with free-text input (type and press Enter, badge display with remove)
- Store keywords in `formData.company_keywords` array

### File 3: `src/components/icp/ICPWizardStep3.tsx`
- Import `useEffectiveOrg`
- Replace `userProfile.org_id` with `effectiveOrgId` (lines 33-54)
- Update placeholder text to: "Enter functional area only (e.g., Cardiology, Revenue Cycle). Seniority is set separately."

### File 4: `src/types/icp.ts`
- Add `company_keywords?: string[]` to both `ICPProfile` and `ICPFormData` interfaces

### File 5: `src/components/icp/ICPWizard.tsx` (initialFormData + save)
- Add `company_keywords: []` to `initialFormData`
- Add `company_keywords` to the save payload in `handleSave`
- Add `company_keywords` to the edit population in `useEffect`

### File 6: Database migration
- Add `company_keywords text[]` column to `icp_profiles` table
- Copy custom attribute definitions from Launchpulse to 91.Life org
- Clean up ICP job titles: strip management-level prefixes from existing titles (keep C-level intact)

### File 7: Scoring engine update (SQL function)
- Update the scoring function to also match `company_keywords` against `industry_raw`, `industry_norm`, and `sub_industry` columns using ILIKE

## Summary of What Each Fix Solves

| Problem | Fix |
|---------|-----|
| ICP "disappears" after Update | Use `effectiveOrgId` in save |
| Industries only dropdown, no keywords | Add company_keywords field + scoring |
| Titles include "Director", "VP" | Clean data + update guidance text |
| Vertical attributes not showing | Use `effectiveOrgId` + copy definitions |
| Dashboard empty | Cascading fix from correct org_id |
| Match count wrong | Use `effectiveOrgId` in RPC call |
