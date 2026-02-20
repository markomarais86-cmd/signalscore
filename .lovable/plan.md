
# Add "Hospitals and Health Care" to Healthcare ICP Industry Filters

## Problem
The Healthcare ICP's `industries` array does not include `"Hospitals and Health Care"`, which is the `industry_norm` value for **100 accounts** (28 with bed counts). These accounts lose up to 20 points on the industry dimension because their industry string doesn't match any entry in the ICP filter.

## Current ICP Industries
```
Healthcare, Hospital & Health Systems, Medical Devices, Health IT,
Hospitals & Physicians Clinics, Healthcare Services
```

Missing: `"Hospitals and Health Care"` and `"Hospitals & Healthcare"` (273 accounts use this variant too).

## Change

Run this SQL in the Supabase SQL Editor to append the two missing industry strings:

```sql
UPDATE icp_profiles
SET industries = array_cat(industries, ARRAY['Hospitals and Health Care', 'Hospitals & Healthcare'])
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';
```

No code changes are needed — this is a data-only update.

## Impact
- **100+ accounts** with `industry_norm = 'Hospitals and Health Care'` will now match the ICP industry filter and earn up to 20 points on the industry dimension
- **273 accounts** with `industry_norm = 'Hospitals & Healthcare'` will also match
- After updating, a re-score of affected accounts is needed to recalculate fit scores

## Steps
1. Run the SQL update in the Supabase SQL Editor
2. Trigger a re-score of hospital accounts to apply the new industry matching
