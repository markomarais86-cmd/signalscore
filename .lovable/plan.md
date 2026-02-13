
# AI-Powered Customer Onboarding from ICP Documents

## What This Builds

A new feature that lets you upload ICP documents (like the 91Life PDF/PowerPoint) and have AI automatically:
1. **Parse the document** and extract all ICP fields (industries, company sizes, revenue ranges, geographies, personas, buying triggers, etc.)
2. **Create a new organization** (e.g., "91Life") if one doesn't exist yet
3. **Auto-populate and save an ICP profile** to `icp_profiles` for that org
4. Redirect you to the Customer Onboarding wizard with everything pre-filled

## Where It Lives

The entry point will be on the **Customer Onboarding page** (`/admin/customer-onboarding`). Right now it shows a grid of existing orgs. We'll add:
- A prominent "AI Onboard Customer" button at the top
- Clicking it opens a dialog/flow where you:
  1. Enter the company name + website (e.g., "91Life", "https://91.life")
  2. Upload one or more ICP documents (PDF, PPTX-as-PDF, etc.)
  3. Click "Generate" -- AI parses the docs, creates the org + ICP, and drops you into the onboarding wizard

## Technical Implementation

### 1. New Edge Function: `parse-icp-document`
- Receives: document text content, company name, website URL, org_id (optional)
- Uses Lovable AI (gemini-3-flash-preview) with structured tool calling to extract:
  - Industries (primary + secondary + excluded)
  - Company sizes (employee ranges)
  - Revenue ranges
  - Geographies
  - Persona job titles, seniority levels, departments, decision roles
  - Buying triggers
  - Company stages, tech stack, growth indicators
  - SIC/NAICS codes (stored in description/tags)
- Creates the organization in `organizations` table if no org_id provided
- Inserts the ICP profile into `icp_profiles` with all extracted fields
- Returns the new org_id and icp_id

### 2. Frontend: `AICustomerOnboardingDialog` component
- A dialog triggered from the Customer Onboarding page
- Fields: Company Name, Website URL, file upload (drag-and-drop)
- On submit:
  - Reads the PDF text client-side (since jsPDF is already installed; or we send raw text extracted from the document)
  - Actually, since the documents are complex PDFs, we'll upload them to Supabase Storage and have the edge function use the document content passed as text
  - The user pastes or the system extracts text from the uploaded PDF
  - Calls the `parse-icp-document` edge function
  - On success, navigates to `/admin/customer-onboarding/{new_org_id}`

### 3. Modified Files
- **`src/pages/admin/CustomerOnboarding.tsx`**: Add "AI Onboard Customer" button to `CustomerOrgPicker` component
- **New: `src/components/admin/AICustomerOnboardingDialog.tsx`**: The dialog with company name, website, document upload
- **New: `supabase/functions/parse-icp-document/index.ts`**: Edge function that uses AI to extract ICP data and create org + ICP profile

### 4. AI Prompt Strategy
The edge function will use tool calling (structured output) to ensure we get clean, typed data back from the AI:

```
Tool: extract_icp_profile
Parameters:
  - company_name: string
  - description: string  
  - industries: string[]
  - excluded_industries: string[]
  - company_sizes: number[] (employee counts)
  - revenue_ranges: string[]
  - geographies: string[]
  - persona_job_titles: string[]
  - persona_seniority_levels: string[]
  - persona_departments: string[]
  - persona_decision_roles: string[]
  - buying_triggers: string[]
  - company_stages: string[]
  - growth_stage: string[]
  - budget_indicators: string[]
  - use_case: string
```

### 5. Document Handling
Since we can't parse PDFs natively in an edge function, the approach is:
- The frontend dialog will have a large textarea where the user can paste the document content (or we pre-populate it from uploaded text)
- For a more polished experience, we can add a file upload that reads the PDF as text on the client side
- The raw text gets sent to the edge function for AI parsing

## User Flow

1. Super admin goes to `/admin/customer-onboarding`
2. Clicks "AI Onboard Customer" button
3. Dialog opens -- enters "91Life" as company name, "https://91.life" as website
4. Pastes or uploads the ICP document content
5. Clicks "Generate ICP"
6. AI processes the document, creates org "91Life" and an active ICP profile
7. User is redirected to `/admin/customer-onboarding/{91life_org_id}` with ICP step showing the populated profile
8. User can continue through the remaining onboarding steps (Team, Routing, Campaigns, Review)
