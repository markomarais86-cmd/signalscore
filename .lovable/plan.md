

# Fix Quick Enrich Modal Layout

## Problem
The Quick Enrich modal content doesn't fit well -- the footer buttons are cramped and the layout feels tight, especially with the "Full Enrichment Options" link alongside "Cancel" and "Start".

## Changes

**File: `src/components/executive/EnrichmentModal.tsx`**

1. **Widen the modal** -- Change `max-w-md` to `max-w-lg` on `DialogContent` (line 114) to give more breathing room.

2. **Fix footer layout** -- Restructure the `DialogFooter` so:
   - "Full Enrichment Options" sits on its own row (full width)
   - "Cancel" and "Start" buttons sit together on a second row, right-aligned
   - This prevents the three buttons from competing for horizontal space

3. **Add padding/spacing** -- Add `pt-2` to the footer to separate it from the form content above.

The updated footer structure:

```
<DialogFooter className="flex-col gap-2 pt-2">
  <div className="flex justify-end gap-2 w-full">
    <Button variant="outline" ...>Cancel</Button>
    <Button ...>Start</Button>
  </div>
  <Button variant="ghost" size="sm" onClick={goToFullEnrichment} className="w-full ...">
    Full Enrichment Options
  </Button>
</DialogFooter>
```

Single-file change, no new dependencies.
