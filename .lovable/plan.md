

## Overview

This plan fixes the title text styling in "The LaunchPulse Difference" cards to match the original launchpulse.org design where titles are bright white and subtitles are muted gray.

## Issue Identified

The current `h3` tag doesn't explicitly set `text-white` on the main title, causing it to appear faded. The original design has:
- **Main titles** (e.g., "Evidence-Based ICP"): Bright white, bold
- **Subtitles** (e.g., "(not opinion-based targeting)"): Muted gray

## What We're Changing

Add explicit `text-white` class to the main title text to ensure it's bright white and stands out from the gray subtitle.

---

## Technical Details

### File to Modify: `src/pages/About.tsx`

**Update the title styling (lines 99-101):**

Current:
```tsx
<h3 className="text-xl font-semibold mb-1">
  {item.title} <span className="text-white/50 font-normal">{item.subtitle}</span>
</h3>
```

Updated:
```tsx
<h3 className="text-xl font-semibold mb-3 text-white">
  {item.title} <span className="text-white/50 font-normal">{item.subtitle}</span>
</h3>
```

**Changes:**
1. Add `text-white` to the `h3` to make the main title bright white
2. Increase margin from `mb-1` to `mb-3` for better spacing (matching the original design)

---

## Visual Result

After this change:
- "Evidence-Based ICP" will be **bright white and bold**
- "(not opinion-based targeting)" will remain **gray/muted** (text-white/50)
- Better spacing between title and description
- Matches the original launchpulse.org design exactly

