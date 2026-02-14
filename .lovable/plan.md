

# Fix: "No tool call in AI response" in optimize-sequence

## Root Cause

The `optimize-sequence` edge function requests structured output via `tools`/`tool_choice`. However, the centralized `callAI` function falls back across providers, and some providers (notably Perplexity) **do not support tool calling**. The `buildRequestBody` function silently strips `tools` and `tool_choice` for Perplexity (lines 707-712 of `ai-config.ts`).

When Perplexity is the first available provider, it returns a plain text response. The function then checks for `tool_calls` at line 95, finds none, and throws `"No tool call in AI response"`.

## Fix

Two changes to make this robust:

### 1. Skip tool-incompatible providers when tools are required (`ai-config.ts`)

In the `callAI` function, when `options.tools` is provided, skip Perplexity in the provider ordering since it cannot return tool calls. This ensures a tool-capable provider handles the request.

### 2. Add text fallback in `optimize-sequence/index.ts`

If the AI response has no `tool_calls` (e.g., provider returned plain text), attempt to parse the message content as JSON instead of immediately throwing. This makes the function resilient to any provider that responds with structured JSON in text form rather than tool calls.

```
// Instead of just throwing:
const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
if (!toolCall) {
  // Fallback: try parsing the text content as JSON
  const content = data.choices?.[0]?.message?.content;
  if (content) {
    // Try to extract JSON from the text response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      recommendations = JSON.parse(jsonMatch[0]);
    }
  }
  if (!recommendations) throw new Error('No tool call in AI response');
}
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/optimize-sequence/index.ts` | Add fallback JSON parsing when no tool_calls in response |
| `supabase/functions/_shared/ai-config.ts` | In `callAI`, skip Perplexity when `tools` are requested |

## Technical Details

- In `ai-config.ts` `callAI` function (~line 775), add a filter: when `options.tools` is set, remove `perplexity` from the ordered provider list since it does not support function calling.
- In `optimize-sequence/index.ts` (lines 94-100), replace the hard throw with a fallback that attempts to parse `message.content` as JSON, extracting the recommendation fields. Only throw if both `tool_calls` and content parsing fail.
- Redeploy the `optimize-sequence` edge function after changes.

