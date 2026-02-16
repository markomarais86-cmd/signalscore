
# Add Social Media Links to Marketing Footer

## What changes

A single file edit to `src/components/marketing/MarketingFooter.tsx` to add social media icon links. Since every public marketing page (Landing, About, Product, Pricing, Contact, Demo, Privacy, Terms, DPA, Security, Subprocessors) already uses this shared `MarketingFooter` component, updating it once covers all pages.

## Social links to add

| Platform  | URL                                          |
|-----------|----------------------------------------------|
| Facebook  | https://www.facebook.com/launch.pulse/       |
| Instagram | https://www.instagram.com/launch.pulse/      |
| LinkedIn  | https://www.linkedin.com/company/launchpulse/ |
| X/Twitter | https://x.com/launchpulse_io                 |

## Implementation

**File:** `src/components/marketing/MarketingFooter.tsx`

- Import `Facebook`, `Instagram`, `Linkedin`, and `Twitter` icons from `lucide-react`
- Add a row of social icon links between the newsletter signup and the legal links row
- Each icon opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`)
- Styled consistently: `text-white/50 hover:text-white transition-colors`, icon size `h-5 w-5`

No other files need changes -- every marketing page already renders `<MarketingFooter />`.

## Technical detail

```
[Newsletter signup]

[Logo]  [FB] [IG] [LI] [X]  [Privacy | Terms | DPA | Security | Subprocessors]  [Copyright]
```

The social icons will sit in a small flex row between the logo and the legal links within the existing layout, keeping the footer compact.
