

## Fix Industry Slide: Only Show Healthcare-Related Industries for 91.Life

### Problem

The industry filtering in `generate-board-report` uses a word-overlap algorithm with a 50% threshold. The 91.Life ICP targets these industries:
- Healthcare
- Hospital & Health Systems
- Medical Devices
- Health IT
- Hospitals & Physicians Clinics
- Healthcare Services

But the word "services" in "Healthcare Services" causes false matches against "Business Services", "Law Firms & Legal Services", "Consumer Services", "Professional Services", and others -- because one shared word out of two = 50% overlap, which passes the threshold.

### Solution

Replace the loose word-overlap matching with a stricter algorithm in `supabase/functions/generate-board-report/index.ts`:

1. **Exact match first** -- if the normalized industry name equals an ICP industry, it's a match
2. **Substring containment** -- if one string fully contains the other (e.g., "Healthcare" is contained in "Healthcare Services"), it's a match
3. **Remove the 50% word-overlap logic entirely** -- this is the source of all false positives
4. **Add a stop-word filter** -- words like "services", "systems", "companies" should be excluded from any fuzzy matching to prevent cross-category contamination

### Expected Result for 91.Life

After the fix, the industry slide will show only:
- **Hospitals & Physicians Clinics** (exact match, ~1,113 accounts)
- **Healthcare Services** (exact match to ICP list)
- **Other (Non-ICP)** (everything else collapsed)

Plus any sub-industries that genuinely contain "healthcare", "hospital", "medical", or "health" as meaningful terms.

### Files to Change

**`supabase/functions/generate-board-report/index.ts`** (lines ~282-294):
- Rewrite `isIcpRelevantIndustry()` to use exact + substring matching only
- Add a stop-word set (`services`, `systems`, `companies`, `firms`) that gets excluded before any partial matching
- Keep the existing ICP-aware filtering structure (lines 296-315) unchanged

### Technical Detail

Current broken logic (line 288-292):
```text
Word overlap: "business services" vs "healthcare services"
wordsA = {business, services}
wordsB = {healthcare, services}
overlap = 1 ("services"), min size = 2
1/2 = 0.5 >= 0.5 threshold --> FALSE POSITIVE
```

New logic:
```text
1. Exact match: "business services" === "healthcare services"? No
2. Substring: "business services" contains "healthcare services"? No
   "healthcare services" contains "business services"? No
3. No match --> correctly excluded
```
