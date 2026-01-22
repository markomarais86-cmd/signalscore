// Phone Verification & Deduplication - Cross-references phones from multiple sources
// Validates E.164 format, deduplicates, and boosts confidence for multi-source matches

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  isValidPhoneNumber, 
  sanitizePhone, 
  hasRepeatingPattern,
  isGPSCoordinate,
  classifyPhoneType,
  type PhoneEntry 
} from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhoneInput {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main';
  source: string;
  confidence: number;
  citation?: string;
}

interface VerifiedPhone {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main';
  sources: string[];
  confidence: number;
  is_valid: boolean;
  format_issues: string[];
  verified_at: string;
}

// Normalize phone number to E.164 format using new utilities
function normalizePhone(phone: string): { normalized: string | null; issues: string[] } {
  const issues: string[] = [];
  
  // Check for GPS coordinates first
  if (isGPSCoordinate(phone)) {
    issues.push('GPS coordinate detected');
    return { normalized: null, issues };
  }
  
  // Check for repeating patterns
  const digits = phone.replace(/\D/g, '');
  if (hasRepeatingPattern(digits)) {
    issues.push('Suspicious repeating digit pattern');
    return { normalized: null, issues };
  }
  
  // Use the new sanitizePhone function
  const sanitized = sanitizePhone(phone);
  
  if (!sanitized) {
    if (digits.length < 7) {
      issues.push('Too short for valid phone');
    } else if (digits.length > 15) {
      issues.push('Too long for valid phone');
    } else {
      issues.push('Invalid phone format');
    }
    return { normalized: null, issues };
  }
  
  return { normalized: sanitized, issues };
}

// Validate phone number format using new utilities
function isValidE164(phone: string): boolean {
  return isValidPhoneNumber(phone);
}

// Calculate similarity between two phone numbers (handles minor variations)
function phoneSimilarity(a: string, b: string): number {
  const cleanA = a.replace(/\D/g, '');
  const cleanB = b.replace(/\D/g, '');
  
  if (cleanA === cleanB) return 1;
  
  // Check if one is a suffix of another (e.g., with/without country code)
  if (cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA)) {
    return 0.9;
  }
  
  // Calculate Levenshtein distance for near-matches
  const maxLen = Math.max(cleanA.length, cleanB.length);
  let distance = 0;
  for (let i = 0; i < maxLen; i++) {
    if (cleanA[i] !== cleanB[i]) distance++;
  }
  
  return 1 - (distance / maxLen);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phones, lead_id, org_id, save_to_db = false } = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return new Response(JSON.stringify({ 
        verified_phones: [],
        stats: { total: 0, valid: 0, duplicates_removed: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[verify-phones] Processing ${phones.length} phone numbers`);

    // Step 1: Normalize all phones, filtering out invalid ones
    const normalizedPhones: Array<PhoneInput & { normalized: string; issues: string[] }> = [];
    let rejected = 0;
    
    for (const p of phones as PhoneInput[]) {
      const { normalized, issues } = normalizePhone(p.number);
      
      // Skip phones that failed validation
      if (!normalized) {
        console.log(`[verify-phones] Rejected: ${p.number} - ${issues.join(', ')}`);
        rejected++;
        continue;
      }
      
      normalizedPhones.push({ ...p, normalized, issues });
    }
    
    if (rejected > 0) {
      console.log(`[verify-phones] Rejected ${rejected} invalid phone numbers`);
    }

    // Step 2: Group by normalized number (deduplication)
    const phoneGroups = new Map<string, Array<typeof normalizedPhones[0]>>();
    
    for (const phone of normalizedPhones) {
      // Skip if normalized is somehow still null (shouldn't happen after filter)
      if (!phone.normalized) continue;
      
      // Find existing group with similar number
      let matched = false;
      for (const [key, group] of phoneGroups) {
        if (phoneSimilarity(phone.normalized, key) >= 0.9) {
          group.push(phone);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        phoneGroups.set(phone.normalized, [phone]);
      }
    }

    // Step 3: Build verified phones from groups
    const verifiedPhones: VerifiedPhone[] = [];
    
    for (const [normalized, group] of phoneGroups) {
      // Collect all unique sources
      const sources = [...new Set(group.map(p => p.source))];
      
      // Merge types (prefer more specific: direct > mobile > office > main)
      const typeOrder = ['direct', 'mobile', 'office', 'main'];
      const types = group.map(p => p.type);
      const bestType = typeOrder.find(t => types.includes(t as any)) || 'office';
      
      // Calculate confidence boost for multi-source verification
      const baseConfidence = Math.max(...group.map(p => p.confidence));
      const sourceBoost = Math.min((sources.length - 1) * 10, 20); // +10% per additional source, max +20%
      const confidence = Math.min(baseConfidence + sourceBoost, 100);
      
      // Check validity
      const isValid = isValidE164(normalized);
      const allIssues = group.flatMap(p => p.issues).filter(Boolean);
      
      verifiedPhones.push({
        number: normalized,
        type: bestType as VerifiedPhone['type'],
        sources,
        confidence,
        is_valid: isValid,
        format_issues: [...new Set(allIssues)],
        verified_at: new Date().toISOString()
      });
    }

    // Sort by confidence (highest first)
    verifiedPhones.sort((a, b) => b.confidence - a.confidence);

    // Step 4: Save to database if requested
    if (save_to_db && lead_id && org_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Build phone_sources object for debugging
      const phoneSources: Record<string, PhoneInput[]> = {};
      for (const phone of phones as PhoneInput[]) {
        if (!phoneSources[phone.source]) {
          phoneSources[phone.source] = [];
        }
        phoneSources[phone.source].push(phone);
      }

      // Update lead with verified phones
      const { error } = await supabase
        .from('Leads')
        .update({
          phones: verifiedPhones,
          phone_sources: phoneSources,
          // Also update legacy fields with primary phone
          phone: verifiedPhones[0]?.number || null,
          mobile: verifiedPhones.find(p => p.type === 'mobile')?.number || null,
          direct_phone: verifiedPhones.find(p => p.type === 'direct')?.number || null,
        })
        .eq('id', lead_id)
        .eq('org_id', org_id);

      if (error) {
        console.error('[verify-phones] Database update error:', error);
      } else {
        console.log(`[verify-phones] Updated lead ${lead_id} with ${verifiedPhones.length} verified phones`);
      }
    }

    const duplicatesRemoved = normalizedPhones.length - verifiedPhones.length;
    const totalRejected = phones.length - normalizedPhones.length;

    console.log(`[verify-phones] Complete: ${verifiedPhones.length} valid phones, ${totalRejected} rejected (invalid), ${duplicatesRemoved} duplicates removed`);

    return new Response(JSON.stringify({
      verified_phones: verifiedPhones,
      stats: {
        total: phones.length,
        unique: verifiedPhones.length,
        valid: verifiedPhones.filter(p => p.is_valid).length,
        rejected_invalid: totalRejected,
        duplicates_removed: duplicatesRemoved,
        multi_source: verifiedPhones.filter(p => p.sources.length > 1).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[verify-phones] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
