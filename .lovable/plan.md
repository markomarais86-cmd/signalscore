

# Improvement Plan: AI Chatbot, AI ICP, Scoring, and Verticals

## 1. AI Chatbot Improvements

**Current state:** Streaming chat via `ai-chat` edge function with OpenAI (gpt-4o-mini) as primary, Lovable/Gemini as fallback. Has action parsing, workflow execution, memory, and rich result cards (accounts, contacts, analytics). No markdown rendering -- messages display as plain `whitespace-pre-wrap` text.

**Improvements:**

- **Markdown rendering**: Replace the plain text `<div className="whitespace-pre-wrap">` in `MessageBubble` with `react-markdown` so bold, lists, links, and tables render properly. The AI already outputs markdown but it shows as raw `**text**`.
- **Conversation persistence**: Currently messages are lost on page refresh. Save conversation history to a `chat_conversations` table so users can resume where they left off.
- **Typing indicator**: Add an animated dot indicator while waiting for the first SSE token (currently just shows nothing until the first chunk arrives).
- **Upgrade model**: The `ai-chat` function uses `gpt-4o-mini` as primary. Switch to `google/gemini-3-flash-preview` via Lovable AI as primary for better reasoning at lower cost.
- **Error message in chat**: When streaming fails, show the error as an assistant message bubble instead of only a toast notification that can be missed.

## 2. AI ICP Builder Improvements

**Current state:** 6-step wizard (Template, Basic Info, Company Targeting, Persona Targeting, Advanced Targeting, Disqualifiers, Preview). Has AI document parser (`parse-icp-document`) and a duplicate `AIICPBuilderDialog`. Closed-Won analysis exists via `ClosedWonInsights`.

**Improvements:**

- **Deduplicate AI builder dialogs**: `AICustomerOnboardingDialog` and `AIICPBuilderDialog` are nearly identical. Consolidate into one shared component.
- **AI-suggested weights**: After ICP creation, auto-suggest weights for each criterion based on historical Closed-Won data. Currently weights are manually set.
- **ICP comparison view**: Add a side-by-side comparison of two ICP profiles showing criteria differences and how many accounts each captures. The `compare_segments` action exists in chat but has no dedicated UI.
- **Validation feedback**: The wizard's Step 6 (Preview) should show estimated account match count by querying existing accounts against the draft criteria before saving.

## 3. Scoring Improvements

**Current state:** Two scoring versions -- `legacy_v1.0` (basic RPC) and `statistical_v2.0` (weighted). Org-level scoring version toggle. Scoring config UI has weight sliders for fit/intent/reachability but intent and reachability are hardcoded to 50 in v2.

**Improvements:**

- **Intent scoring (real signals)**: Replace the hardcoded `intent: 50` placeholder in `score-account` with actual signal data. The `compute-intent-signals` edge function exists but isn't wired into scoring. Connect it.
- **Score explanation UI**: When viewing an account's score, show a breakdown of WHY it scored that way (which criteria matched, which didn't). The `breakdown` data is stored in `scores.reasons` but not displayed anywhere.
- **Score simulation**: In the Scoring Configuration page, allow users to pick a real account and see how weight changes affect its score in real-time (currently uses hardcoded sample accounts like "Acme Corp").
- **Score drift detection**: Track score changes over time and surface accounts whose scores changed significantly after re-scoring (e.g., dropped 20+ points).

## 4. Vertical / Custom Attributes Improvements

**Current state:** 4 industry templates (Healthcare, SaaS, Manufacturing, Retail) with predefined custom attribute fields. Attributes are stored in `custom_attribute_definitions` and used in ICP wizard Step 2 via `vertical_filters`. Each attribute has an `enrichment_prompt` for AI enrichment.

**Improvements:**

- **More vertical templates**: Add Financial Services, Education, and Professional Services templates -- common B2B verticals currently missing.
- **Auto-suggest verticals**: When a user creates an ICP targeting specific industries, automatically suggest relevant vertical attribute templates they haven't installed yet.
- **Vertical attributes in scoring**: Currently `vertical_filters` in the ICP are stored but the scoring engine (`score-account`, `calculate_weighted_account_score`) doesn't factor them in. Wire vertical attribute matches into the scoring calculation.
- **Bulk vertical enrichment**: Add a "Fill Missing Attributes" button that runs the `enrichment_prompt` for all accounts missing a specific vertical field, using AI enrichment.

---

## Technical Details

### Files to modify:

| Area | Files | Change |
|------|-------|--------|
| Chatbot markdown | `src/components/AIChat.tsx` | Add `react-markdown` to `MessageBubble` |
| Chatbot model | `supabase/functions/ai-chat/index.ts` | Switch primary provider order to Lovable first |
| Chatbot typing | `src/components/AIChat.tsx` | Add loading dots before first token |
| ICP dedup | `src/components/icp/AIICPBuilderDialog.tsx`, `src/components/admin/AICustomerOnboardingDialog.tsx` | Consolidate into one component |
| Intent scoring | `supabase/functions/score-account/index.ts` | Call `compute-intent-signals` and use real value |
| Score breakdown | New component `src/components/accounts/ScoreBreakdown.tsx` | Visual breakdown of score reasons |
| Score simulation | `src/components/settings/ScoringConfiguration.tsx` | Replace hardcoded samples with real account picker |
| Vertical templates | `src/components/settings/CustomAttributeManager.tsx` | Add FinServ, Education, ProfServ templates |
| Vertical scoring | `supabase/functions/score-account/index.ts` | Include vertical_filters in score calc |

### Dependencies to add:
- `react-markdown` (for chatbot markdown rendering)

### Priority order:
1. Chatbot markdown rendering (highest visual impact, simplest change)
2. Intent scoring wiring (fixes placeholder data)
3. Score breakdown UI (makes scoring transparent)
4. Vertical attributes in scoring (completes the vertical feature)
5. Everything else

