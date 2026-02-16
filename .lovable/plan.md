

# Fix ICP Profile Summary Card -- Field Mappings and Layout

## Problems

1. **Wrong field names** -- The component reads `countries`, `job_titles`, `seniority_levels`, `departments` but the database columns are `geographies`, `persona_job_titles`, `persona_seniority_levels`, `persona_departments`. This causes Geographies, Personas, and Tech Stack sections to render empty despite having rich data.

2. **Poor layout** -- The current `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4` layout creates awkward uneven columns. With 14 industries, 50+ job titles, 10 geographies, 8 pain points, etc., the card needs a better visual structure that organizes this dense information cleanly.

3. **Missing data dimensions** -- The ICP has rich data (pain points, buying signals, confidence score, company stages) that is not displayed at all.

## Changes

### File: `src/components/executive/ICPProfileSummaryCard.tsx` (full rewrite)

**1. Fix field mappings:**
```
countries       -> profile.geographies
jobTitles       -> profile.persona_job_titles
seniorityLevels -> profile.persona_seniority_levels
departments     -> profile.persona_departments
```

**2. Add missing fields:**
- `pain_points` -- shown with AlertCircle icon
- `buying_signals` -- shown with TrendingUp icon
- `confidence_score` -- shown as a badge in the header (e.g., "50% confidence")
- `company_stages` -- if present

**3. Redesign layout to a 3-column grid:**
- Column 1: Industries + Company Profile (sizes + revenue)
- Column 2: Geographies + Tech Stack
- Column 3: Personas (seniority, departments, job titles) + Pain Points

This groups related data logically and prevents the uneven column widths caused by the current 4-column layout.

**4. Increase tag limits:**
- Industries: show up to 6 (there are 14)
- Geographies: show up to 6 (there are 10)
- Job titles: show up to 5 (there are 50+)
- Pain points: show up to 4

**5. Spacing compliance:**
- CardHeader: `pb-4` per SPACING_GUIDE
- CardContent: `space-y-4` for section spacing
- Grid: `gap-4` for compact content grid

## No other files change

The dashboard already renders `<ICPProfileSummaryCard icpProfiles={icpProfiles} />` at line 606 of ExecutiveDashboard.tsx. Only the component itself needs fixing.

