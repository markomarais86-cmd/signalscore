

# Update LaunchPulse Brand Colors in Database

## The Problem
The `org_onboarding_config` table stores incorrect brand colors for LaunchPulse:
- **Current**: `brand_primary_color: #6366f1` (indigo), `brand_secondary_color: #818cf8` (light indigo)
- **Correct**: `brand_primary_color: #3CF1AE` (teal/mint), `brand_secondary_color: #34D399` (emerald green)

This affects the customer dashboard, sidebar accents, branded landing pages, and any component that reads brand config from the database.

## The Fix
A single database update to correct both color values:

```sql
UPDATE org_onboarding_config
SET brand_primary_color = '#3CF1AE',
    brand_secondary_color = '#34D399',
    updated_at = now()
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
```

## What This Fixes
- Customer dashboard sidebar and header accents will use teal instead of indigo
- Branded marketing pages (`/p/:orgSlug`) will render with the correct teal palette
- The PDF report generator's `isLaunchPulse` override becomes a safety net rather than the only source of truth
- All CSS custom property bindings (`--brand-primary`) will resolve to teal

## No Code Changes Needed
The existing code already reads these values correctly -- the data was simply wrong. After this DB update, everything becomes consistent without any client-side overrides.

