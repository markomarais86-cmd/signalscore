

# AI-Suggested Industry Templates Based on ICP Profile

## Problem
The Settings > Verticals page shows Industry Templates (Healthcare, SaaS/Technology, Manufacturing, Retail) but treats them all equally. The system already has an active ICP profile with target industries (Technology, Healthcare, Manufacturing, Retail, etc.) but doesn't use that data to recommend which templates to apply. Users have to manually figure out which templates are relevant.

## Solution
Fetch the active ICP profile's industries inside `CustomAttributeManager` and use them to highlight/recommend matching templates. Add an "AI Suggested" badge and visual emphasis to templates whose category matches an ICP industry, plus an "Apply All Suggested" button.

## Changes

### File: `src/components/settings/CustomAttributeManager.tsx`

1. **Fetch ICP industries on mount** -- query `icp_profiles` for the active profile's `industries` array (same pattern used elsewhere with `useEffectiveOrg`).

2. **Match templates to ICP industries** -- compare each template's `category` against the ICP industries list using fuzzy matching:
   - "Healthcare" matches ICP industry "Healthcare"
   - "SaaS" matches "Technology" or "Software"
   - "Manufacturing" matches "Manufacturing"
   - "Retail" matches "Retail"

3. **Visual treatment for suggested templates**:
   - Add an "AI Suggested" badge (with Sparkles icon) on matching template cards
   - Highlight matching cards with a colored border (e.g., `border-primary`)
   - Sort suggested templates first in the grid

4. **"Apply All Suggested" button** -- a single button above the template grid that applies all matching templates at once, skipping any fields that already exist.

5. **Already-applied indicator** -- if a template's fields are already in `definitions`, show a checkmark and "Applied" label instead of letting users re-click it.

### No new files needed. No database changes.

## Technical Details

```typescript
// Inside CustomAttributeManager, add state:
const [icpIndustries, setIcpIndustries] = useState<string[]>([]);

// Fetch on mount alongside loadDefinitions:
useEffect(() => {
  if (effectiveOrgId) {
    supabase
      .from('icp_profiles')
      .select('industries')
      .eq('org_id', effectiveOrgId)
      .eq('status', 'active')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.industries) setIcpIndustries(data.industries);
      });
  }
}, [effectiveOrgId]);

// Matching logic:
const CATEGORY_INDUSTRY_MAP: Record<string, string[]> = {
  'Healthcare': ['Healthcare'],
  'SaaS': ['Technology', 'Software', 'SaaS', 'IT Services'],
  'Manufacturing': ['Manufacturing'],
  'Retail': ['Retail', 'E-commerce'],
};

const isSuggested = (template) => {
  const matchTerms = CATEGORY_INDUSTRY_MAP[template.category] || [];
  return matchTerms.some(term => 
    icpIndustries.some(ind => ind.toLowerCase().includes(term.toLowerCase()))
  );
};
```

The template grid will render suggested templates with a highlighted border and badge, and an "Apply All Suggested" action button will batch-apply all matching templates.

