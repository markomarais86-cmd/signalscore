// Carrier Verification Edge Function
// Uses NumVerify API to validate phone numbers and retrieve carrier/line type info

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { lookupCarrier, lookupCarrierBatch, type CarrierInfo } from "../_shared/carrier-lookup.ts";
import { sanitizePhone, isValidPhoneNumber } from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyCarrierRequest {
  phones: string[];
  lead_id?: number;
  org_id?: string;
  save_to_db?: boolean;
  update_primary?: boolean; // Update primary phone field based on carrier info
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
    total_cost: number;
  };
  best_mobile?: string;
  best_phone?: string;
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
      update_primary = false 
    }: VerifyCarrierRequest = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return new Response(JSON.stringify({
        results: {},
        stats: { total: 0, valid: 0, invalid: 0, mobile: 0, landline: 0, unknown: 0, total_cost: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 50;
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

    // Look up carrier info for all valid phones
    const carrierResults = await lookupCarrierBatch(normalizedPhones, {
      maxConcurrent: 1,
      delayMs: 150 // Rate limit protection
    });

    // Build response
    const results: Record<string, CarrierInfo> = {};
    let validCount = 0;
    let invalidCount = 0;
    let mobileCount = 0;
    let landlineCount = 0;
    let unknownCount = 0;
    let totalCost = 0;
    let bestMobile: string | undefined;
    let bestPhone: string | undefined;

    for (const [phone, info] of carrierResults) {
      const originalPhone = phoneMap.get(phone) || phone;
      results[originalPhone] = info;
      totalCost += info.lookup_cost;

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
        total_cost: totalCost,
      },
      best_mobile: bestMobile,
      best_phone: bestPhone,
    };

    // Save to database if requested
    if (save_to_db && lead_id && org_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get existing phones and update with carrier info
      const { data: lead, error: fetchError } = await supabase
        .from('Leads')
        .select('phones')
        .eq('id', lead_id)
        .eq('org_id', org_id)
        .single();

      if (!fetchError && lead) {
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
              // Reclassify type based on carrier data
              type: carrierInfo.line_type === 'mobile' ? 'mobile' : 
                    carrierInfo.line_type === 'landline' ? 'office' : p.type,
            };
          }
          return p;
        });

        const updateData: any = { phones: updatedPhones };

        // Optionally update primary phone fields based on carrier info
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
    }

    console.log(`[verify-carrier] Complete: ${validCount} valid, ${mobileCount} mobile, ${landlineCount} landline`);

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
