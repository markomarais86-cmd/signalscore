// Carrier Verification Edge Function
// Uses NumVerify API to validate phone numbers and retrieve carrier/line type info
// Includes background processing for large batches and proper rate limit handling

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { lookupCarrier, lookupCarrierBatch, type CarrierInfo } from "../_shared/carrier-lookup.ts";
import { sanitizePhone, isValidPhoneNumber } from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const MAX_BATCH_SIZE = 50;
const BACKGROUND_THRESHOLD = 10; // Process in background if more than this many phones
const INTER_REQUEST_DELAY_MS = 1000; // 1 second between requests to avoid rate limits

interface VerifyCarrierRequest {
  phones: string[];
  lead_id?: number;
  org_id?: string;
  save_to_db?: boolean;
  update_primary?: boolean;
  force_sync?: boolean; // Force synchronous processing even for large batches
}

interface VerifyCarrierResponse {
  results: Record<string, CarrierInfo>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
    mobile: number;
    landline: number;
    unknown: number;
    cached: number;
    total_cost: number;
  };
  best_mobile?: string;
  best_phone?: string;
  processing_mode: 'sync' | 'background';
  queued?: boolean;
  message?: string;
}

// Background processing function
async function processInBackground(
  normalizedPhones: string[],
  phoneMap: Map<string, string>,
  lead_id: number | undefined,
  org_id: string | undefined,
  save_to_db: boolean,
  update_primary: boolean
): Promise<void> {
  console.log(`[verify-carrier] Starting background processing for ${normalizedPhones.length} phones`);
  
  try {
    const carrierResults = await lookupCarrierBatch(normalizedPhones, {
      maxConcurrent: 1,
      delayMs: INTER_REQUEST_DELAY_MS,
      orgId: org_id,
    });

    // Build results
    const results: Record<string, CarrierInfo> = {};
    let bestMobile: string | undefined;
    let bestPhone: string | undefined;

    for (const [phone, info] of carrierResults) {
      const originalPhone = phoneMap.get(phone) || phone;
      results[originalPhone] = info;

      if (info.valid) {
        if (!bestPhone) bestPhone = phone;
        if (info.line_type === 'mobile' && !bestMobile) {
          bestMobile = phone;
        }
      }
    }

    // Save to database if requested
    if (save_to_db && lead_id && org_id) {
      await updateLeadWithCarrierInfo(lead_id, org_id, results, update_primary, bestMobile, bestPhone);
    }

    console.log(`[verify-carrier] Background processing complete for ${normalizedPhones.length} phones`);
  } catch (error) {
    console.error('[verify-carrier] Background processing error:', error);
  }
}

// Update lead with carrier information
async function updateLeadWithCarrierInfo(
  lead_id: number,
  org_id: string,
  results: Record<string, CarrierInfo>,
  update_primary: boolean,
  bestMobile?: string,
  bestPhone?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: lead, error: fetchError } = await supabase
    .from('Leads')
    .select('phones')
    .eq('id', lead_id)
    .eq('org_id', org_id)
    .single();

  if (fetchError || !lead) {
    console.error('[verify-carrier] Failed to fetch lead:', fetchError);
    return;
  }

  const existingPhones = (lead.phones || []) as any[];
  
  // Update phones with carrier info
  const updatedPhones = existingPhones.map((p: any) => {
    const carrierInfo = results[p.number];
    if (carrierInfo && carrierInfo.valid) {
      return {
        ...p,
        carrier_name: carrierInfo.carrier,
        line_type: carrierInfo.line_type,
        carrier_verified_at: new Date().toISOString(),
        type: carrierInfo.line_type === 'mobile' ? 'mobile' : 
              carrierInfo.line_type === 'landline' ? 'office' : p.type,
      };
    }
    return p;
  });

  const updateData: any = { phones: updatedPhones };

  if (update_primary) {
    if (bestMobile) {
      updateData.mobile = bestMobile;
    }
    if (bestPhone && !bestMobile) {
      updateData.phone = bestPhone;
    }
  }

  const { error: updateError } = await supabase
    .from('Leads')
    .update(updateData)
    .eq('id', lead_id)
    .eq('org_id', org_id);

  if (updateError) {
    console.error('[verify-carrier] Database update error:', updateError);
  } else {
    console.log(`[verify-carrier] Updated lead ${lead_id} with carrier info`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      phones, 
      lead_id, 
      org_id, 
      save_to_db = false,
      update_primary = false,
      force_sync = false,
    }: VerifyCarrierRequest = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return new Response(JSON.stringify({
        results: {},
        stats: { total: 0, valid: 0, invalid: 0, mobile: 0, landline: 0, unknown: 0, cached: 0, total_cost: 0 },
        processing_mode: 'sync',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Limit batch size to prevent abuse
    if (phones.length > MAX_BATCH_SIZE) {
      return new Response(JSON.stringify({ 
        error: `Maximum ${MAX_BATCH_SIZE} phones per request` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[verify-carrier] Processing ${phones.length} phone numbers`);

    // Normalize phones first
    const normalizedPhones: string[] = [];
    const phoneMap = new Map<string, string>(); // normalized -> original
    
    for (const phone of phones) {
      const normalized = sanitizePhone(phone);
      if (normalized && isValidPhoneNumber(normalized)) {
        normalizedPhones.push(normalized);
        phoneMap.set(normalized, phone);
      } else {
        console.log(`[verify-carrier] Skipping invalid phone: ${phone}`);
      }
    }

    // For large batches, process in background unless force_sync is set
    if (normalizedPhones.length > BACKGROUND_THRESHOLD && !force_sync) {
      console.log(`[verify-carrier] Queuing ${normalizedPhones.length} phones for background processing`);
      
      // Use EdgeRuntime.waitUntil for background processing
      (globalThis as any).EdgeRuntime?.waitUntil?.(
        processInBackground(normalizedPhones, phoneMap, lead_id, org_id, save_to_db, update_primary)
      );

      // Return immediately with queued status
      const response: VerifyCarrierResponse = {
        results: {},
        stats: {
          total: phones.length,
          valid: 0,
          invalid: 0,
          mobile: 0,
          landline: 0,
          unknown: 0,
          cached: 0,
          total_cost: 0,
        },
        processing_mode: 'background',
        queued: true,
        message: `${normalizedPhones.length} phone numbers queued for background verification. Results will be saved to the database.`,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Synchronous processing for small batches
    const carrierResults = await lookupCarrierBatch(normalizedPhones, {
      maxConcurrent: 1,
      delayMs: INTER_REQUEST_DELAY_MS,
      orgId: org_id,
    });

    // Build response
    const results: Record<string, CarrierInfo> = {};
    let validCount = 0;
    let invalidCount = 0;
    let mobileCount = 0;
    let landlineCount = 0;
    let unknownCount = 0;
    let cachedCount = 0;
    let totalCost = 0;
    let bestMobile: string | undefined;
    let bestPhone: string | undefined;

    for (const [phone, info] of carrierResults) {
      const originalPhone = phoneMap.get(phone) || phone;
      results[originalPhone] = info;
      totalCost += info.lookup_cost;

      if (info.cached) cachedCount++;

      if (info.valid) {
        validCount++;
        if (!bestPhone) bestPhone = phone;
        
        switch (info.line_type) {
          case 'mobile':
            mobileCount++;
            if (!bestMobile) bestMobile = phone;
            break;
          case 'landline':
            landlineCount++;
            break;
          default:
            unknownCount++;
        }
      } else {
        invalidCount++;
      }
    }

    // Add invalid phones from original list
    for (const phone of phones) {
      if (!results[phone]) {
        results[phone] = {
          valid: false,
          number: phone,
          local_format: '',
          international_format: '',
          country_prefix: '',
          country_code: '',
          country_name: '',
          location: null,
          carrier: null,
          line_type: 'unknown',
          error: 'Invalid phone format',
          lookup_cost: 0,
          cached: false,
        };
        invalidCount++;
      }
    }

    const response: VerifyCarrierResponse = {
      results,
      stats: {
        total: phones.length,
        valid: validCount,
        invalid: invalidCount,
        mobile: mobileCount,
        landline: landlineCount,
        unknown: unknownCount,
        cached: cachedCount,
        total_cost: totalCost,
      },
      best_mobile: bestMobile,
      best_phone: bestPhone,
      processing_mode: 'sync',
    };

    // Save to database if requested
    if (save_to_db && lead_id && org_id) {
      await updateLeadWithCarrierInfo(lead_id, org_id, results, update_primary, bestMobile, bestPhone);
    }

    console.log(`[verify-carrier] Complete: ${validCount} valid, ${mobileCount} mobile, ${landlineCount} landline, ${cachedCount} cached`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[verify-carrier] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});