

# Add Skip Patterns to Filter Non-Healthcare False Positives

## Problem

The Perplexity/Gemini AI is returning false bed counts for non-healthcare companies. Out of ~165 accounts with `bed_count > 0`, at least 20+ are clearly not hospitals -- banks, industrial conglomerates, insurance companies, government entities, and military organizations are being assigned bed counts ranging from 500 to 4,847.

## Examples of False Positives

| Company | Domain | False Bed Count | Category |
|---------|--------|----------------|----------|
| Bank of Georgia Group | bankofgeorgiagroup.com | 4,461 | Banking |
| Acciona | acciona.com | 4,847 | Industrial |
| Arvind | arvind.com | 3,500 | Textile/Industrial |
| Allianz | allianz.de | 2,823 | Insurance |
| ArcelorMittal | corporate.arcelormittal.com | 1,347 | Steel |
| Adani | adani.com | 2,000 | Conglomerate |
| AIG | aig.com | 800 | Insurance |
| 1543 Capital | 1543capital.com | 526 | Finance |
| Alleghany | alleghany.com | 2,500 | Finance |
| Al Jaber | aljaber.com | 1,168 | Construction |
| Bahri | bahri.sa | 500 | Shipping |
| Altice | nuvancehealth.org | 2,303 | Telecom |
| Auma | auma.com | 786 | Industrial valves |
| Artemis | artemis.uk.com | 713 | Investment |
| Anne Arundel County | aacounty.org | 684 | Government |

## Solution

### 1. Expand SKIP_PATTERNS regex in `supabase/functions/enrich-bed-counts/index.ts`

Add the following categories to the existing regex:

- **Banking/Finance:** bank, banking, capital, equity, securities, investment, hedge fund, asset management, venture, private equity, financial group, credit union, savings, brokerage, wealth management
- **Insurance (non-health):** allianz, aig, prudential, metlife, allstate, geico, underwriter
- **Industrial/Manufacturing:** steel, mining, cement, chemical, petroleum, oil, gas, energy, refinery, smelter, foundry, textile, manufacturing
- **Conglomerates (known):** adani, acciona, arcelormittal, arvind, tata (non-health), al jaber
- **Government/Military:** county, municipality, city of, town of, borough, guards, regiment, battalion, brigade, air force, navy, army
- **Telecom/Tech (non-health):** telecom, telco, broadband, cable, wireless, data center
- **Shipping/Transport:** shipping, maritime, tanker, fleet, cargo, port authority

### 2. Reset false positive bed counts

Write a migration to set `bed_count = 0` for known false positives already in the database. This targets the ~20 clearly incorrect entries identified above.

### 3. File changes

**`supabase/functions/enrich-bed-counts/index.ts`** (line 22):
Update the `SKIP_PATTERNS` regex constant to include the new patterns. The expanded regex will follow the same `\b...\b` word-boundary format as the existing patterns.

**New migration file:**
A SQL migration to reset `custom_attributes` for the specific false-positive account IDs, setting their `bed_count` back to `0`.

## Technical Notes

- The regex uses case-insensitive matching (`/i` flag) so capitalization does not matter
- Word boundaries (`\b`) prevent partial matches (e.g., "bank" won't match "Fairbanks")
- The edge function must be redeployed after the code change
- Already-processed accounts with false bed counts need a one-time data fix via migration

