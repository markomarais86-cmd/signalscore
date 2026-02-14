

# Fix: PDF and PPTX Upload Support in AI ICP Builder

## Problem

The AI ICP Builder dialog currently:
1. **Cannot accept PPTX files** -- the file input only allows `.txt, .csv, .pdf` and there is no PowerPoint parsing logic
2. **PDF parsing is fragile** -- uses client-side `pdfjs-dist` which fails silently on many real-world PDFs (encrypted, image-heavy, complex layouts), leaving the textarea empty with just an error toast

The screenshot shows the user uploaded "91Life Persona Playbook v2.pptx.pdf" but the ICP Document Content textarea remained empty -- parsing failed.

## Solution

Create a server-side edge function to handle document parsing for both PDF and PPTX, since the browser cannot parse PowerPoint files natively.

### New Edge Function: `parse-document`

A lightweight Deno edge function that:
- Accepts a file upload (multipart form data)
- Detects the file type (PDF or PPTX)
- For **PDF**: Uses a server-side approach to extract text (pdf-parse or similar Deno-compatible library)
- For **PPTX**: Extracts text from the XML structure inside the ZIP archive (PPTX files are ZIP files containing XML slides)
- Returns the extracted text as JSON

PPTX parsing approach: PPTX files are ZIP archives. Each slide is an XML file at `ppt/slides/slideN.xml`. The text is inside `<a:t>` tags. We can use Deno's built-in ZIP handling (via `JSZip` or manual ZIP parsing) to read these XML files and extract all text content.

### Frontend Changes: `AICustomerOnboardingDialog.tsx`

1. **Expand accepted file types**: Change `accept` to `.txt,.csv,.pdf,.pptx,.ppt`
2. **Replace client-side PDF parsing** with a call to the new `parse-document` edge function
3. **Send file as FormData** to the edge function for server-side processing
4. **Better error messages**: Show specific errors for different failure modes

## Technical Details

### Edge Function: `supabase/functions/parse-document/index.ts`

```
// Accepts: multipart/form-data with a "file" field
// Returns: { text: string, pages: number, format: string }

// PPTX parsing:
// 1. Read file as Uint8Array
// 2. Use JSZip to unzip
// 3. Find all ppt/slides/slide*.xml files
// 4. Parse XML, extract all <a:t> text nodes
// 5. Concatenate with slide separators

// PDF parsing:
// 1. Use pdf-parse compatible Deno library
// 2. Extract text from all pages
// 3. Return concatenated text
```

### Frontend Changes: `AICustomerOnboardingDialog.tsx`

| Change | Detail |
|--------|--------|
| File input `accept` | Add `.pptx,.ppt` to accepted types |
| `handleFileUpload` | Upload file to `parse-document` edge function via FormData instead of client-side pdfjs |
| Error handling | Show specific error for each failure type |
| Loading state | Keep existing spinner, update label to "Parsing document..." |

### Flow

```
User selects file (.pdf or .pptx)
  -> Frontend sends file to parse-document edge function
  -> Edge function extracts text server-side
  -> Returns extracted text
  -> Frontend populates textarea
  -> User clicks "Generate ICP"
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/parse-document/index.ts` | New edge function for PDF + PPTX text extraction |
| `src/components/admin/AICustomerOnboardingDialog.tsx` | Use edge function for parsing, add PPTX to accepted types |

## What This Fixes

- PPTX files will be parsed and text extracted automatically
- PDF parsing moves server-side where it is more reliable
- Users no longer need to manually copy-paste from PowerPoint presentations
- The `pdfjs-dist` client-side dependency can optionally be removed later (reduces bundle size)

