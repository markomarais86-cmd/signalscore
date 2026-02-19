/**
 * Bulk Bed Count Enrichment
 * 
 * Finds accounts missing bed_count in custom_attributes and uses
 * Perplexity (primary) + Lovable AI (fallback) to look up hospital bed counts.
 * Processes in batches with time budget awareness.
 * 
 * POST /enrich-bed-counts
 * { "org_id": "uuid", "batch_size": 50 }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { successResponse, errorResponse, handleCors, ErrorCodes, parseJsonBody, validateRequired } from '../_shared/response-helpers.ts';

const MAX_RUNTIME_MS = 50_000;
const DEFAULT_BATCH_SIZE = 200;
const AI_FETCH_TIMEOUT_MS = 15_000;

const SKIP_PATTERNS = /\b(hotel|motel|resort|inn|suites|lodge|hostel|aimbridge|marriott|hilton|hyatt|wyndham|ihg|accor|bestwestern|choicehotels|restaurant|cafe|diner|barbershop|salon|spa\b(?!.*medical)|gym|fitness|realty|real estate|mortgage|insurance(?!.*health)|automotive|dealership|car wash|laundry|cleaners|landscap|plumbing|electric(?!.*medical)|roofing|construction|trucking|logistics(?!.*health)|freight|shipping|warehouse(?!.*pharma)|bank(?!.*blood|.*tissue)|banking|capital(?!.*health|.*medical)|equity|securities|investment|hedge fund|asset management|venture|private equity|financial group|credit union|savings|brokerage|wealth management|blackstone|allianz|prudential|metlife|allstate|geico|underwriter|steel|mining|cement|chemical|petroleum|oil\b(?!.*medical)|gas\b(?!.*medical)|energy(?!.*health)|refinery|smelter|foundry|textile|manufacturing|adani|acciona|arcelormittal|aramco|arvind|al jaber|county(?!.*health|.*medical|.*hospital)|municipality|city of|town of|borough|guards|regiment|battalion|brigade|air force\b|navy\b|army\b|telecom|telco|broadband|cable\b(?!.*health)|wireless(?!.*health)|data center|maritime|tanker|fleet|cargo|port authority)\b/i;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');

  try {
    // Auth — allow service role key OR scheduled trigger to bypass user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse(ErrorCodes.UNAUTHORIZED, 'Missing authorization', 401);

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    const body = await parseJsonBody<{ org_id: string; batch_size?: number; triggered_by?: string }>(req);
    const isScheduled = body?.triggered_by === 'scheduled';

    if (!isServiceRole && !isScheduled) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return errorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid token', 401);
    }
    const validation = validateRequired(body, ['org_id']);
    if (!validation.valid) return errorResponse(ErrorCodes.VALIDATION_ERROR, `Missing: ${validation.missing.join(', ')}`, 400);

    const { org_id, batch_size: requestedBatchSize } = body!;
    const batchSize = Math.min(requestedBatchSize || DEFAULT_BATCH_SIZE, 200);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const startTime = Date.now();

    // Resolve data org (parent) for account queries
    const { data: orgData } = await supabase
      .from('organizations')
      .select('parent_org_id')
      .eq('id', org_id)
      .single();
    const dataOrgId = orgData?.parent_org_id || org_id;

    // Find accounts missing bed_count that have a name or domain
    // Filter bed_count absence at DB level to avoid fetching already-processed accounts
    const { data: accounts, error: fetchErr } = await supabase
      .from('accounts')
      .select('id, external_id, name, domain, custom_attributes')
      .eq('org_id', dataOrgId)
      .or('name.not.is.null,domain.not.is.null')
      .is('custom_attributes->bed_count', null)
      .order('name', { ascending: true })
      .limit(batchSize);

    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch accounts', 500);
    }

    const needsBeds = accounts || [];

    console.log(`[enrich-bed-counts] Found ${needsBeds.length} accounts needing bed_count (from ${accounts?.length} candidates)`);

    if (needsBeds.length === 0) {
      return successResponse({ message: 'All accounts already have bed_count data', enriched: 0, total_missing: 0 });
    }

    // === Change 2: Pre-skip non-hospitals in bulk BEFORE AI calls ===
    const regexSkipped: typeof needsBeds = [];
    const aiCandidates: typeof needsBeds = [];

    for (const account of needsBeds) {
      const companyName = account.name || '';
      const domain = account.domain || '';
      if (SKIP_PATTERNS.test(companyName) || SKIP_PATTERNS.test(domain)) {
        regexSkipped.push(account);
      } else {
        aiCandidates.push(account);
      }
    }

    // Bulk-update regex-skipped accounts with bed_count: 0
    let bulkSkipped = 0;
    if (regexSkipped.length > 0) {
      const BULK_BATCH = 20;
      for (let i = 0; i < regexSkipped.length; i += BULK_BATCH) {
        const chunk = regexSkipped.slice(i, i + BULK_BATCH);
        await Promise.all(chunk.map(async (account) => {
          const existingAttrs = (account.custom_attributes as Record<string, any>) || {};
          const updatedAttrs = { ...existingAttrs, bed_count: 0 };
          const { error } = await supabase
            .from('accounts')
            .update({ custom_attributes: updatedAttrs })
            .eq('id', account.id);
          if (!error) bulkSkipped++;
        }));
      }
      console.log(`[enrich-bed-counts] Bulk pre-skipped ${bulkSkipped} non-hospital accounts (regex)`);
    }

    let enriched = 0;
    let failed = 0;
    let skipped = bulkSkipped;

    // Process only AI candidates
    const PARALLEL_BATCH = 3;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < aiCandidates.length; i += PARALLEL_BATCH) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[enrich-bed-counts] Time budget exceeded after ${enriched} enrichments`);
        break;
      }

      const batch = aiCandidates.slice(i, i + PARALLEL_BATCH);
      const results = await Promise.allSettled(
        batch.map(account => enrichBedCount(account, perplexityKey, lovableKey))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const account = batch[j];

        if (result.status === 'fulfilled' && result.value != null) {
          const bedCount = result.value;
          const existingAttrs = (account.custom_attributes as Record<string, any>) || {};
          const updatedAttrs = { ...existingAttrs, bed_count: bedCount };

          const { error: updateErr } = await supabase
            .from('accounts')
            .update({ custom_attributes: updatedAttrs })
            .eq('id', account.id);

          if (updateErr) {
            console.error(`[enrich-bed-counts] Update failed for ${account.name}:`, updateErr.message);
            failed++;
          } else {
            console.log(`[enrich-bed-counts] ✓ ${account.name}: ${bedCount} beds`);
            enriched++;
          }
        } else if (result.status === 'fulfilled' && result.value == null) {
          // === Change 1: Persist skipped accounts with bed_count: 0 ===
          const existingAttrs = (account.custom_attributes as Record<string, any>) || {};
          const updatedAttrs = { ...existingAttrs, bed_count: 0 };
          await supabase
            .from('accounts')
            .update({ custom_attributes: updatedAttrs })
            .eq('id', account.id);
          skipped++;
        } else {
          console.error(`[enrich-bed-counts] Error for ${account.name}:`, (result as PromiseRejectedResult).reason);
          failed++;
        }
      }

      // Rate limit: wait 2s between batches
      if (i + PARALLEL_BATCH < aiCandidates.length) {
        await delay(2000);
      }
    }

    // Count remaining missing
    const { count: remainingMissing } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', dataOrgId)
      .or('name.not.is.null,domain.not.is.null');

    console.log(`[enrich-bed-counts] Done: ${enriched} enriched, ${failed} failed, ${skipped} skipped (not hospitals)`);

    return successResponse({
      enriched,
      failed,
      skipped,
      remaining_total: remainingMissing || 0,
      message: `Enriched ${enriched} accounts with bed count data`,
    });

  } catch (error) {
    console.error('[enrich-bed-counts] Error:', error);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Unexpected error', 500);
  }
});

// === Change 3: Added AbortController timeouts to fetch calls ===
async function enrichBedCount(
  account: { name: string | null; domain: string | null; external_id: string },
  perplexityKey: string | undefined,
  lovableKey: string | undefined,
): Promise<number | null> {
  const companyName = account.name || extractDomainName(account.external_id) || '';
  const domain = account.domain || '';

  if (!companyName && !domain) return null;

  const prompt = `How many licensed hospital/healthcare facility beds does "${companyName}" (${domain}) have? Return ONLY a JSON object like {"bed_count": 150}. If this is not a hospital or healthcare facility with beds, return {"bed_count": null}. Do NOT return strings like "Not applicable" — only return a number or null. If you cannot determine the exact number, provide your best estimate.`;

  // Try Perplexity first (real-time web search)
  if (perplexityKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'system', content: 'You are a healthcare data expert. Return ONLY valid JSON. No markdown, no explanation.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.bed_count === 'number' && parsed.bed_count > 0) {
            return parsed.bed_count;
          }
          return null;
        }
      } else {
        const errText = await response.text().catch(() => '');
        console.warn(`[enrich-bed-counts] Perplexity error ${response.status}: ${errText.substring(0, 200)}`);
      }
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'timeout' : e.message;
      console.warn(`[enrich-bed-counts] Perplexity failed for ${companyName}: ${msg}`);
    }
  }

  // Fallback to Lovable AI (Gemini)
  if (lovableKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a healthcare data expert. Return ONLY valid JSON. No markdown.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.bed_count === 'number' && parsed.bed_count > 0) {
            return parsed.bed_count;
          }
          return null;
        }
      }
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'timeout' : e.message;
      console.warn(`[enrich-bed-counts] Gemini failed for ${companyName}: ${msg}`);
    }
  }

  return null;
}

function extractDomainName(externalId: string): string | null {
  if (externalId.startsWith('lp-')) {
    const domain = externalId.slice(3);
    return domain.replace(/\.(com|org|net|io|co|health|care)$/i, '').replace(/[.-]/g, ' ');
  }
  return null;
}
