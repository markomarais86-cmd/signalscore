

## Add Detailed Logging to Enrichment Pipeline

Add granular logging at key points in the Perplexity custom attribute enrichment flow so you can trace exactly what happens during each enrichment call.

### Changes

**File: `supabase/functions/_shared/provider-waterfall.ts`**

Add logging at these specific points in Step 4.5:

1. **Before Perplexity call** (~line 2364): Log the full prompt being sent, including company name, domain, and all custom attribute questions
2. **Perplexity raw response** (~line 2383): Log the raw content returned by Perplexity before JSON parsing
3. **Parsed custom attributes** (~line 2395): Log the actual parsed values for each field (currently only logs count -- expand to show key-value pairs)
4. **Perplexity HTTP failure** (~line 2381): Log status code and response body when Perplexity returns non-OK
5. **No JSON found** (~line 2387): Log when regex fails to find JSON in the response
6. **Gemini raw response** (~line 2442): Log Gemini's raw response for the fallback call
7. **Final custom_attributes object** (~line 2466): Log the complete final `custom_attributes` object being saved

**File: `supabase/functions/enrich-unified/index.ts`**

No additional changes needed -- it already logs `custom_attributes` at line 330.

### Specific Log Additions

```text
provider-waterfall.ts, Step 4.5:

[provider-waterfall] Step 4.5: Perplexity prompt for "Nathan Littauer Hospital" (nlh.org): <full prompt text>
[provider-waterfall] Step 4.5: Perplexity raw response: <raw content string>
[provider-waterfall] Step 4.5: Perplexity parsed values: {"bed_count": 74, "facility_type": "Community Hospital", ...}
[provider-waterfall] Step 4.5: Perplexity HTTP error: 429 {"error": "rate limited"}
[provider-waterfall] Step 4.5: No JSON found in Perplexity response: <first 200 chars>
[provider-waterfall] Step 4.5: Gemini raw response: <raw content string>
[provider-waterfall] Step 4.5: Final custom_attributes: {"bed_count": 74, "facility_type": "Community Hospital", "ehr_system": "Other"}
```

### Technical Details

Seven `console.log` / `console.warn` additions in `supabase/functions/_shared/provider-waterfall.ts`, all within the existing Step 4.5 block (lines 2345-2471). No logic changes -- purely observability improvements. Redeploy `enrich-unified` after editing since it imports the shared module.

