
# Global Modal/Dialog Styling Improvement

## Problem

The current Dialog and AlertDialog components have minimal default styling. This affects all 34+ modal instances across the application, making them look plain and inconsistent.

## Solution

Update the base UI components in `src/components/ui/dialog.tsx` and `src/components/ui/alert-dialog.tsx` to apply polished styling globally. This single change will automatically improve every modal in the app.

---

## Visual Changes

### Before vs After

```
BEFORE (plain):                    AFTER (polished):
┌─────────────────────┐            ┌─────────────────────┐
│ Quick Enrich      ✕ │            │▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│ ← gradient accent
│                     │            │ Quick Enrich      ✕ │
│ Description text... │            │ Description text... │
│                     │            ├─────────────────────┤ ← subtle divider
│ [content]           │            │ [content]           │
│                     │            │                     │
│      [Cancel][Save] │            │      [Cancel][Save] │
└─────────────────────┘            └─────────────────────┘
```

---

## File Changes

| File | Action |
|------|--------|
| `src/components/ui/dialog.tsx` | Update - Add gradient accent, improve header/footer |
| `src/components/ui/alert-dialog.tsx` | Update - Match dialog styling for consistency |

---

## Technical Details

### DialogContent Updates
- Add `overflow-hidden` and `relative` for gradient positioning
- Include gradient accent bar as a pseudo-element or inline element

### DialogHeader Updates  
- Add bottom border separator
- Improve padding for visual breathing room

### DialogTitle Updates
- Slightly larger font weight for emphasis
- Better line height for multi-line titles

### DialogFooter Updates
- Add top border separator
- Improve spacing between header/content/footer

### Same Changes for AlertDialog
- Mirror all improvements in `alert-dialog.tsx`
- Ensure destructive actions remain visually distinct

---

## Result

After this change:
- All 34+ dialogs across the app will have consistent premium styling
- No individual modal files need to be updated
- Future dialogs automatically inherit the improved design
- Brand-consistent gradient accent on all modals
