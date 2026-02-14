

# Custom Vertical Attributes: AI-Powered Discovery Pipeline

## What You're Asking

You need the system to:
1. Let users define vertical-specific targeting criteria (e.g., "hospitals with 300-1,000 beds")
2. Use ALL existing AI providers (Perplexity, Firecrawl, Lovable/Gemini, Claude, Grok, Apollo, PDL, Hunter) to **find that data** for existing accounts AND discover new accounts externally
3. Make this a reusable pattern -- not just healthcare, but any vertical attribute for any customer

## Current State

Your enrichment infrastructure already has:
- **Provider waterfall** (`provider-waterfall.ts`): 2,485-line system that chains Perplexity, Firecrawl, Claude, Gemini, Grok, PDL, Apollo, Hunter in sequence
- **AI discovery** (`ai-discover-accounts`): Uses Perplexity + Lovable AI to find NEW accounts matching ICP criteria
- **Multi-provider aggregation** (`callAIAllProviders` in `ai-config.ts`): Calls all available AI providers and merges results with voting
- **21 enrichable fields** hardcoded in `ALL_ENRICHABLE_FIELDS`

The gap: all 21 fields are generic firmographics. There is nowhere to define "bed_count" or "facility_type" and no prompt tells the AI to look for those things.

## The Fix: Three Connected Changes

### Change 1: Schema -- Store Custom Attributes

**Database migration:**
- Add `custom_attributes jsonb DEFAULT '{}'` to `accounts` table
- Add `vertical_filters jsonb DEFAULT '{}'` to `icp_profiles` table
- Create `custom_attribute_definitions` table:

```text
custom_attribute_definitions
  id              uuid PRIMARY KEY
  org_id          uuid REFERENCES organizations(id)
  field_key       text        -- e.g., "bed_count"
  field_label     text        -- e.g., "Number of Beds"
  field_type      text        -- "number", "text", "select", "multi_select"
  options         text[]      -- for select types: ["Academic Medical Center", "Community Hospital"]
  category        text        -- e.g., "Healthcare"
  enrichment_prompt text      -- AI instruction: "How many hospital beds does this facility have?"
  created_at      timestamptz
```

The `enrichment_prompt` column is the key innovation -- it tells the AI providers exactly what to search for.

### Change 2: AI Enrichment -- Teach Providers to Find Custom Data

**How each provider gets used:**

| Provider | Role for Custom Attributes | How |
|----------|--------------------------|-----|
| **Perplexity** (sonar-pro) | Primary discovery -- real-time web search | Prompt: "For [company], find: [enrichment_prompt for each custom attribute]" -- returns cited, verifiable data |
| **Firecrawl** | Ground truth -- scrape company website | Scrape the company's website, then pass HTML to AI for extraction: "Extract bed count, facility type from this page" |
| **Lovable/Gemini** (gemini-2.5-flash) | Fast structured extraction | Parse Perplexity + Firecrawl raw content into structured custom_attributes JSON via tool calling |
| **Claude** (claude-sonnet-4) | Deep reasoning validation | Cross-validate extracted values: "Is 450 beds reasonable for an Academic Medical Center?" |
| **Grok** (grok-3) | Social/news signals | Search X/Twitter for recent mentions: facility expansions, new wings, closures |
| **Apollo** | Contact enrichment only | No custom attribute data, but discovers contacts AT those accounts |
| **PDL** | Firmographic fallback | Standard fields only, no custom attributes |
| **Hunter** | Email verification only | Verify contacts found at custom-attribute-matching accounts |

**Implementation in `provider-waterfall.ts`:**

Add a new Stage 4.5 "Custom Attribute Enrichment" after the multi-provider AI aggregation stage:

1. Load the org's `custom_attribute_definitions` from the database
2. For each definition that has an `enrichment_prompt`, build a provider-specific prompt
3. Call Perplexity with: "For [company_name] ([domain]), [enrichment_prompt]. Return the answer as a specific value."
4. Call Firecrawl to scrape the company website, then pass to Gemini: "From this website content, extract: [enrichment_prompt]"
5. Use cross-provider voting (already built) to pick the best answer
6. Store results in the record's `custom_attributes` JSONB

The prompt construction uses the `enrichment_prompt` from the definition, so each org's custom fields get provider-specific AI research automatically.

**New fields in `EnrichedData` interface:**
```typescript
export interface EnrichedData {
  // ... existing 21 fields ...
  custom_attributes?: Record<string, any>;  // NEW
}
```

**New field in `WaterfallConfig`:**
```typescript
export interface WaterfallConfig {
  // ... existing fields ...
  customAttributeDefinitions?: Array<{
    field_key: string;
    field_type: string;
    enrichment_prompt: string;
    options?: string[];
  }>;
}
```

### Change 3: Discovery -- Find NEW Accounts Matching Custom Criteria

**Enhance `ai-discover-accounts/index.ts`:**

Currently `DiscoveryCriteria` only supports: industries, geographies, company_sizes, revenue_ranges, keywords, tech_stack.

Add:
```typescript
interface DiscoveryCriteria {
  // ... existing fields ...
  vertical_filters?: Record<string, any>;  // NEW: e.g., { facility_type: ["Academic Medical Center"], bed_count_min: 100 }
}
```

Update `buildPerplexitySearchPrompt()` to include vertical criteria:
```
Current: "Find 20 real B2B companies in Healthcare located in US..."
New:     "Find 20 Academic Medical Centers with 100-1,000 beds in the United States..."
```

This makes Perplexity search for accounts that match the custom vertical criteria, not just generic firmographics. The discovered accounts get imported with their custom attributes pre-populated.

### Change 4: ICP Wizard -- Let Users Define Vertical Targeting

**`src/types/icp.ts`** -- Add to `ICPFormData`:
```typescript
vertical_filters?: Record<string, any>;
```

**`src/components/icp/ICPWizardStep2.tsx`** -- Add a "Vertical Attributes" card:
- Loads the org's `custom_attribute_definitions`
- For `number` types: renders min/max range inputs
- For `select`/`multi_select` types: renders checkbox groups
- For `text` types: renders keyword inputs
- If no definitions exist, shows a link to Settings to create them

**`src/components/settings/CustomAttributeManager.tsx`** -- New Settings page:
- Add/edit/delete custom attribute definitions
- Each definition has: label, key, type, options, and the `enrichment_prompt`
- Pre-built templates per vertical (Healthcare, SaaS, Manufacturing, Retail, etc.)
- Healthcare template auto-creates: facility_type, bed_count, ehr_system, specialties, cms_star_rating

### Change 5: Enrichment Pipeline Integration

**`enrich-unified/index.ts`** -- Load custom attribute definitions:
- Before calling `runEnrichmentWaterfall`, fetch the org's `custom_attribute_definitions`
- Pass them into the waterfall config
- After enrichment, store `result.data.custom_attributes` into `accounts.custom_attributes`

**`enrich-unified/index.ts`** account update block (around line 264):
```typescript
// Existing field mapping...
if (result.data.custom_attributes) {
  updateData.custom_attributes = result.data.custom_attributes;
}
```

### Change 6: CSV Upload Support

- During CSV column mapping, unmapped columns are offered as custom attribute mappings
- Values stored directly into `accounts.custom_attributes` JSONB
- This is the immediate path for customers who already have the data in spreadsheets

## End-to-End Flow (Healthcare Example)

```text
1. Admin goes to Settings -> Custom Attributes
2. Clicks "Healthcare Template" -> creates:
   - facility_type (select): Academic Medical Center, Community Hospital, etc.
   - bed_count (number): enrichment_prompt = "How many licensed hospital beds does this facility have?"
   - ehr_system (select): Epic, Cerner, Meditech, etc.
   - specialties (multi_select): Cardiology, Oncology, etc.

3. Admin goes to ICP Builder -> Step 2 now shows "Vertical Attributes" card
4. Sets: facility_type = "Academic Medical Center", bed_count = 100-1000

5. Two things happen:
   a. INTERNAL: Enrichment runs on existing accounts
      - Perplexity searches "How many beds does [hospital] have?"
      - Firecrawl scrapes hospital website, Gemini extracts bed count
      - Claude validates the number
      - Results stored in accounts.custom_attributes.bed_count
      
   b. EXTERNAL: AI Discovery searches for NEW accounts
      - Perplexity prompt: "Find Academic Medical Centers with 100-1000 beds in US"
      - Results imported with custom_attributes pre-populated
      - Scored against ICP immediately

6. Dashboard shows TAM based on accounts matching ALL criteria including vertical filters
```

## File Changes

| File | Change |
|------|--------|
| **SQL Migration** | Add `custom_attributes` to accounts, `vertical_filters` to icp_profiles, create `custom_attribute_definitions` table |
| `src/types/icp.ts` | Add `vertical_filters` to `ICPFormData` |
| `src/components/icp/ICPWizardStep2.tsx` | Add "Vertical Attributes" card |
| `src/components/settings/CustomAttributeManager.tsx` | **New** -- define custom fields with enrichment prompts |
| `src/pages/Settings.tsx` | Add Custom Attributes tab |
| `supabase/functions/_shared/provider-waterfall.ts` | Add Stage 4.5 for custom attribute enrichment using enrichment_prompt |
| `supabase/functions/enrich-unified/index.ts` | Load org's custom definitions, pass to waterfall, store results |
| `supabase/functions/ai-discover-accounts/index.ts` | Accept `vertical_filters` in criteria, include in Perplexity search prompt |

## Phased Delivery

**Phase 1 (this implementation):**
- Schema changes
- Custom Attribute Manager in Settings with industry templates
- ICP Wizard vertical targeting card
- CSV upload mapping to custom attributes
- Enrichment pipeline: Perplexity + Firecrawl + Gemini for custom attribute discovery
- AI Discovery: vertical filters in search prompts

**Phase 2 (follow-on):**
- Scoring engine: custom attributes as scoring factors
- Reference DB: merge custom attributes from ZoomInfo/master data
- Accuracy benchmarking for custom attributes
- More industry templates

