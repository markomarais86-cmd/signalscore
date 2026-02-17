import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Official ZoomInfo 23 Primary Industries
const ZOOMINFO_PRIMARIES = [
  "Agriculture",
  "Business Services",
  "Construction",
  "Consumer Services",
  "Education",
  "Energy, Utilities & Waste",
  "Finance",
  "Government",
  "Healthcare Services",
  "Holding Companies & Conglomerates",
  "Hospitals & Physicians Clinics",
  "Hospitality",
  "Insurance",
  "Law Firms & Legal Services",
  "Manufacturing",
  "Media & Internet",
  "Minerals & Mining",
  "Organizations",
  "Real Estate",
  "Retail",
  "Software",
  "Telecommunications",
  "Transportation",
];

// Keyword-based mapping to ZoomInfo primaries
const KEYWORD_MAP: [string, string][] = [
  // Software
  ["computer software", "Software"],
  ["software development", "Software"],
  ["saas", "Software"],
  ["cybersecurity", "Software"],
  ["online gaming", "Software"],
  ["desktop computing", "Software"],
  // Business Services
  ["professional services", "Business Services"],
  ["it services", "Business Services"],
  ["it consulting", "Business Services"],
  ["business consulting", "Business Services"],
  ["advertising", "Business Services"],
  ["marketing", "Business Services"],
  ["engineering services", "Business Services"],
  ["research services", "Business Services"],
  ["accounting", "Business Services"],
  ["human resources", "Business Services"],
  ["outsourcing", "Business Services"],
  ["offshoring", "Business Services"],
  ["graphic design", "Business Services"],
  ["printing services", "Business Services"],
  ["management consulting", "Business Services"],
  ["consulting", "Business Services"],
  ["staffing", "Business Services"],
  ["information technology", "Business Services"],
  ["security services", "Business Services"],
  ["training and coaching", "Business Services"],
  // Manufacturing
  ["manufacturing", "Manufacturing"],
  ["semiconductor", "Manufacturing"],
  ["automotive parts", "Manufacturing"],
  ["motor vehicle", "Manufacturing"],
  ["machinery", "Manufacturing"],
  ["chemicals", "Manufacturing"],
  ["chemical", "Manufacturing"],
  ["pharmaceuticals", "Manufacturing"],
  ["pharmaceutical", "Manufacturing"],
  ["biotechnology", "Manufacturing"],
  ["biotech", "Manufacturing"],
  ["medical devices", "Manufacturing"],
  ["medical equipment", "Manufacturing"],
  ["electronics manufacturing", "Manufacturing"],
  ["aerospace", "Manufacturing"],
  ["defense and space", "Manufacturing"],
  ["food and beverage", "Manufacturing"],
  ["food & beverage", "Manufacturing"],
  ["packaging", "Manufacturing"],
  ["plastics", "Manufacturing"],
  ["textiles", "Manufacturing"],
  ["apparel", "Manufacturing"],
  ["consumer goods", "Manufacturing"],
  ["sporting goods", "Manufacturing"],
  ["furniture", "Manufacturing"],
  // Finance
  ["financial services", "Finance"],
  ["banking", "Finance"],
  ["investment", "Finance"],
  ["capital markets", "Finance"],
  ["venture capital", "Finance"],
  ["private equity", "Finance"],
  ["fintech", "Finance"],
  // Education
  ["education", "Education"],
  ["university", "Education"],
  ["college", "Education"],
  ["school", "Education"],
  ["e-learning", "Education"],
  // Hospitals & Physicians Clinics
  ["hospitals", "Hospitals & Physicians Clinics"],
  ["hospital", "Hospitals & Physicians Clinics"],
  ["health care", "Hospitals & Physicians Clinics"],
  ["healthcare", "Hospitals & Physicians Clinics"],
  ["medical practices", "Hospitals & Physicians Clinics"],
  ["surgical", "Hospitals & Physicians Clinics"],
  ["physicians", "Hospitals & Physicians Clinics"],
  // Healthcare Services
  ["wellness", "Healthcare Services"],
  ["fitness", "Healthcare Services"],
  ["veterinary", "Healthcare Services"],
  ["mental health", "Healthcare Services"],
  ["ambulance", "Healthcare Services"],
  ["alternative medicine", "Healthcare Services"],
  // Government
  ["government", "Government"],
  ["federal", "Government"],
  ["state &", "Government"],
  ["administration of justice", "Government"],
  ["executive offices", "Government"],
  // Energy
  ["energy", "Energy, Utilities & Waste"],
  ["oil and gas", "Energy, Utilities & Waste"],
  ["oil & gas", "Energy, Utilities & Waste"],
  ["utilities", "Energy, Utilities & Waste"],
  ["renewables", "Energy, Utilities & Waste"],
  ["renewable energy", "Energy, Utilities & Waste"],
  ["environmental services", "Energy, Utilities & Waste"],
  // Hospitality
  ["hospitality", "Hospitality"],
  ["travel", "Hospitality"],
  ["casino", "Hospitality"],
  ["gambling", "Hospitality"],
  ["museum", "Hospitality"],
  ["sports", "Hospitality"],
  ["hotel", "Hospitality"],
  ["restaurant", "Hospitality"],
  ["entertainment", "Hospitality"],
  ["performing arts", "Hospitality"],
  ["recreation", "Hospitality"],
  ["libraries", "Hospitality"],
  // Media & Internet
  ["media", "Media & Internet"],
  ["broadcasting", "Media & Internet"],
  ["publishing", "Media & Internet"],
  ["newspaper", "Media & Internet"],
  ["music production", "Media & Internet"],
  ["musicians", "Media & Internet"],
  ["animation", "Media & Internet"],
  // Law
  ["law", "Law Firms & Legal Services"],
  ["legal", "Law Firms & Legal Services"],
  // Real Estate
  ["real estate", "Real Estate"],
  ["property management", "Real Estate"],
  // Transportation
  ["transportation", "Transportation"],
  ["trucking", "Transportation"],
  ["logistics", "Transportation"],
  ["shipping", "Transportation"],
  ["freight", "Transportation"],
  ["airlines", "Transportation"],
  ["aviation", "Transportation"],
  ["rail", "Transportation"],
  ["warehousing", "Transportation"],
  ["maritime", "Transportation"],
  // Organizations
  ["non-profit", "Organizations"],
  ["nonprofit", "Organizations"],
  ["civic", "Organizations"],
  ["religious", "Organizations"],
  ["charitable", "Organizations"],
  ["membership organization", "Organizations"],
  // Others
  ["holding companies", "Holding Companies & Conglomerates"],
  ["mining", "Minerals & Mining"],
  ["telecom", "Telecommunications"],
  ["wireless", "Telecommunications"],
  ["satellite", "Telecommunications"],
  ["cable &", "Telecommunications"],
  ["insurance", "Insurance"],
  ["construction", "Construction"],
  ["architecture", "Construction"],
  ["agriculture", "Agriculture"],
  ["farming", "Agriculture"],
  ["forestry", "Agriculture"],
  ["retail", "Retail"],
  ["wholesale", "Retail"],
];

function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

function matchIndustry(input: string): { primary: string; confidence: number; method: string } | null {
  const normalized = normalizeString(input);

  // 1. Exact match against primaries
  for (const primary of ZOOMINFO_PRIMARIES) {
    if (normalizeString(primary) === normalized) {
      return { primary, confidence: 1.0, method: "exact" };
    }
  }

  // 2. Keyword matching
  for (const [keyword, primary] of KEYWORD_MAP) {
    if (normalized.includes(keyword)) {
      return { primary, confidence: 0.85, method: "keyword" };
    }
  }

  // 3. Partial match against primaries
  for (const primary of ZOOMINFO_PRIMARIES) {
    const pNorm = normalizeString(primary);
    if (normalized.includes(pNorm) || pNorm.includes(normalized)) {
      return { primary, confidence: 0.7, method: "partial" };
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry_raw } = await req.json();

    if (!industry_raw || typeof industry_raw !== 'string') {
      return new Response(
        JSON.stringify({ industry_norm: null, sub_industry: null, confidence: 0, method: 'none' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Check industry_mapping table for exact match
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: mapping } = await supabase
      .from("industry_mapping")
      .select("zoominfo_primary, zoominfo_sub, confidence")
      .eq("raw_industry", industry_raw)
      .maybeSingle();

    if (mapping) {
      return new Response(
        JSON.stringify({
          industry_norm: mapping.zoominfo_primary,
          sub_industry: mapping.zoominfo_sub,
          confidence: mapping.confidence || 1.0,
          method: "db_lookup",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fuzzy match against ZoomInfo taxonomy
    const result = matchIndustry(industry_raw);

    if (result) {
      // Cache the mapping for future lookups
      await supabase.from("industry_mapping").upsert(
        {
          raw_industry: industry_raw,
          zoominfo_primary: result.primary,
          zoominfo_sub: null,
          confidence: result.confidence,
          mapped_at: new Date().toISOString(),
        },
        { onConflict: "raw_industry" }
      ).then(() => {});

      return new Response(
        JSON.stringify({
          industry_norm: result.primary,
          sub_industry: null,
          confidence: result.confidence,
          method: result.method,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No match
    return new Response(
      JSON.stringify({ industry_norm: null, sub_industry: null, confidence: 0, method: 'none' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in standardize-industry:', error);
    return new Response(
      JSON.stringify({ industry_norm: null, sub_industry: null, confidence: 0, method: 'error', error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
