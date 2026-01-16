import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * lookup-naics: NAICS code lookup, validation, and AI inference
 * 
 * Features:
 * 1. Lookup NAICS code by industry name
 * 2. Validate existing NAICS codes
 * 3. AI inference for unmapped industries
 */

// Common NAICS codes for B2B SaaS targeting
const NAICS_DATABASE: Record<string, { code: string; title: string; sic?: string }> = {
  // Technology & Software
  "custom computer programming services": { code: "541511", title: "Custom Computer Programming Services", sic: "7371" },
  "computer systems design services": { code: "541512", title: "Computer Systems Design Services", sic: "7373" },
  "other computer related services": { code: "541519", title: "Other Computer Related Services", sic: "7379" },
  "software publishers": { code: "511210", title: "Software Publishers", sic: "7372" },
  "data processing hosting": { code: "518210", title: "Data Processing, Hosting, and Related Services", sic: "7374" },
  "internet publishing": { code: "519130", title: "Internet Publishing and Broadcasting", sic: "7375" },
  "computer equipment merchant wholesalers": { code: "423430", title: "Computer Equipment Merchant Wholesalers", sic: "5045" },
  "electronic computer manufacturing": { code: "334111", title: "Electronic Computer Manufacturing", sic: "3571" },
  "software": { code: "541511", title: "Custom Computer Programming Services", sic: "7371" },
  "technology": { code: "541512", title: "Computer Systems Design Services", sic: "7373" },
  "saas": { code: "511210", title: "Software Publishers", sic: "7372" },
  "cloud computing": { code: "518210", title: "Data Processing, Hosting, and Related Services", sic: "7374" },
  "it services": { code: "541512", title: "Computer Systems Design Services", sic: "7373" },
  "information technology": { code: "541512", title: "Computer Systems Design Services", sic: "7373" },
  "cybersecurity": { code: "541512", title: "Computer Systems Design Services", sic: "7373" },
  "artificial intelligence": { code: "541511", title: "Custom Computer Programming Services", sic: "7371" },
  "machine learning": { code: "541511", title: "Custom Computer Programming Services", sic: "7371" },
  
  // Financial Services
  "commercial banking": { code: "522110", title: "Commercial Banking", sic: "6022" },
  "investment banking": { code: "523110", title: "Investment Banking and Securities Dealing", sic: "6211" },
  "credit unions": { code: "522130", title: "Credit Unions", sic: "6061" },
  "insurance carriers": { code: "524113", title: "Direct Life Insurance Carriers", sic: "6311" },
  "insurance": { code: "524210", title: "Insurance Agencies and Brokerages", sic: "6411" },
  "financial services": { code: "523999", title: "Miscellaneous Financial Investment Activities", sic: "6282" },
  "fintech": { code: "522320", title: "Financial Transactions Processing", sic: "6099" },
  "payments": { code: "522320", title: "Financial Transactions Processing", sic: "6099" },
  "banking": { code: "522110", title: "Commercial Banking", sic: "6022" },
  "wealth management": { code: "523930", title: "Investment Advice", sic: "6282" },
  "asset management": { code: "523920", title: "Portfolio Management", sic: "6282" },
  
  // Healthcare
  "offices of physicians": { code: "621111", title: "Offices of Physicians", sic: "8011" },
  "general medical and surgical hospitals": { code: "622110", title: "General Medical and Surgical Hospitals", sic: "8062" },
  "home health care services": { code: "621610", title: "Home Health Care Services", sic: "8082" },
  "medical laboratories": { code: "621511", title: "Medical Laboratories", sic: "8071" },
  "healthcare": { code: "621999", title: "All Other Miscellaneous Ambulatory Health Care Services", sic: "8099" },
  "healthtech": { code: "621999", title: "All Other Miscellaneous Ambulatory Health Care Services", sic: "8099" },
  "medical devices": { code: "339112", title: "Surgical and Medical Instrument Manufacturing", sic: "3841" },
  "pharmaceuticals": { code: "325412", title: "Pharmaceutical Preparation Manufacturing", sic: "2834" },
  "biotechnology": { code: "541711", title: "Research and Development in Biotechnology", sic: "8731" },
  "telemedicine": { code: "621999", title: "All Other Miscellaneous Ambulatory Health Care Services", sic: "8099" },
  
  // Manufacturing
  "automobile manufacturing": { code: "336111", title: "Automobile Manufacturing", sic: "3711" },
  "aerospace": { code: "336411", title: "Aircraft Manufacturing", sic: "3721" },
  "industrial machinery": { code: "333249", title: "Other Industrial Machinery Manufacturing", sic: "3559" },
  "electronics manufacturing": { code: "334419", title: "Other Electronic Component Manufacturing", sic: "3679" },
  "food manufacturing": { code: "311999", title: "All Other Miscellaneous Food Manufacturing", sic: "2099" },
  "chemical manufacturing": { code: "325199", title: "All Other Basic Organic Chemical Manufacturing", sic: "2869" },
  "manufacturing": { code: "339999", title: "All Other Miscellaneous Manufacturing", sic: "3999" },
  
  // Retail & E-commerce
  "electronic shopping": { code: "454110", title: "Electronic Shopping and Mail-Order Houses", sic: "5961" },
  "general merchandise stores": { code: "452311", title: "Warehouse Clubs and Supercenters", sic: "5311" },
  "clothing stores": { code: "448140", title: "Family Clothing Stores", sic: "5651" },
  "grocery stores": { code: "445110", title: "Supermarkets and Other Grocery Stores", sic: "5411" },
  "retail": { code: "452319", title: "All Other General Merchandise Stores", sic: "5399" },
  "e-commerce": { code: "454110", title: "Electronic Shopping and Mail-Order Houses", sic: "5961" },
  "consumer goods": { code: "452319", title: "All Other General Merchandise Stores", sic: "5399" },
  
  // Professional Services
  "management consulting": { code: "541611", title: "Administrative Management Consulting Services", sic: "8742" },
  "accounting services": { code: "541211", title: "Offices of Certified Public Accountants", sic: "8721" },
  "legal services": { code: "541110", title: "Offices of Lawyers", sic: "8111" },
  "advertising agencies": { code: "541810", title: "Advertising Agencies", sic: "7311" },
  "public relations": { code: "541820", title: "Public Relations Agencies", sic: "8743" },
  "marketing": { code: "541613", title: "Marketing Consulting Services", sic: "8742" },
  "consulting": { code: "541611", title: "Administrative Management Consulting Services", sic: "8742" },
  "staffing": { code: "561311", title: "Employment Placement Agencies", sic: "7361" },
  "hr services": { code: "541612", title: "Human Resources Consulting Services", sic: "8742" },
  "recruiting": { code: "561311", title: "Employment Placement Agencies", sic: "7361" },
  
  // Real Estate & Construction
  "real estate": { code: "531210", title: "Offices of Real Estate Agents and Brokers", sic: "6531" },
  "property management": { code: "531311", title: "Residential Property Managers", sic: "6531" },
  "construction": { code: "236220", title: "Commercial and Institutional Building Construction", sic: "1542" },
  "architecture": { code: "541310", title: "Architectural Services", sic: "8712" },
  "engineering services": { code: "541330", title: "Engineering Services", sic: "8711" },
  
  // Education
  "colleges and universities": { code: "611310", title: "Colleges, Universities, and Professional Schools", sic: "8221" },
  "elementary and secondary schools": { code: "611110", title: "Elementary and Secondary Schools", sic: "8211" },
  "education": { code: "611699", title: "All Other Miscellaneous Schools and Instruction", sic: "8299" },
  "edtech": { code: "611699", title: "All Other Miscellaneous Schools and Instruction", sic: "8299" },
  "training": { code: "611430", title: "Professional and Management Development Training", sic: "8299" },
  
  // Media & Entertainment
  "motion picture and video production": { code: "512110", title: "Motion Picture and Video Production", sic: "7812" },
  "radio broadcasting": { code: "515112", title: "Radio Stations", sic: "4832" },
  "television broadcasting": { code: "515120", title: "Television Broadcasting", sic: "4833" },
  "media": { code: "519130", title: "Internet Publishing and Broadcasting", sic: "7375" },
  "entertainment": { code: "711219", title: "Other Spectator Sports", sic: "7941" },
  "gaming": { code: "713290", title: "Other Gambling Industries", sic: "7993" },
  "video games": { code: "511210", title: "Software Publishers", sic: "7372" },
  
  // Transportation & Logistics
  "air transportation": { code: "481111", title: "Scheduled Passenger Air Transportation", sic: "4512" },
  "trucking": { code: "484110", title: "General Freight Trucking, Local", sic: "4212" },
  "warehousing": { code: "493110", title: "General Warehousing and Storage", sic: "4225" },
  "logistics": { code: "488510", title: "Freight Transportation Arrangement", sic: "4731" },
  "shipping": { code: "483111", title: "Deep Sea Freight Transportation", sic: "4412" },
  "transportation": { code: "488999", title: "All Other Support Activities for Transportation", sic: "4789" },
  "supply chain": { code: "488510", title: "Freight Transportation Arrangement", sic: "4731" },
  
  // Energy & Utilities
  "electric power generation": { code: "221112", title: "Fossil Fuel Electric Power Generation", sic: "4911" },
  "natural gas distribution": { code: "221210", title: "Natural Gas Distribution", sic: "4924" },
  "oil and gas extraction": { code: "211120", title: "Crude Petroleum Extraction", sic: "1311" },
  "renewable energy": { code: "221114", title: "Solar Electric Power Generation", sic: "4911" },
  "cleantech": { code: "221114", title: "Solar Electric Power Generation", sic: "4911" },
  "energy": { code: "221122", title: "Electric Power Distribution", sic: "4911" },
  "utilities": { code: "221122", title: "Electric Power Distribution", sic: "4911" },
  
  // Telecommunications
  "wired telecommunications carriers": { code: "517311", title: "Wired Telecommunications Carriers", sic: "4813" },
  "wireless telecommunications carriers": { code: "517312", title: "Wireless Telecommunications Carriers", sic: "4812" },
  "telecommunications": { code: "517919", title: "All Other Telecommunications", sic: "4899" },
  "telecom": { code: "517919", title: "All Other Telecommunications", sic: "4899" },
  
  // Agriculture
  "crop production": { code: "111998", title: "All Other Miscellaneous Crop Farming", sic: "0191" },
  "animal production": { code: "112990", title: "All Other Animal Production", sic: "0291" },
  "agriculture": { code: "111998", title: "All Other Miscellaneous Crop Farming", sic: "0191" },
  "agtech": { code: "111998", title: "All Other Miscellaneous Crop Farming", sic: "0191" },
  
  // Government
  "federal government": { code: "921110", title: "Executive Offices", sic: "9111" },
  "state government": { code: "921120", title: "Legislative Bodies", sic: "9121" },
  "local government": { code: "921130", title: "Public Finance Activities", sic: "9311" },
  "government": { code: "921190", title: "Other General Government Support", sic: "9199" },
  "public sector": { code: "921190", title: "Other General Government Support", sic: "9199" },
  
  // Non-profit
  "religious organizations": { code: "813110", title: "Religious Organizations", sic: "8661" },
  "grantmaking foundations": { code: "813211", title: "Grantmaking Foundations", sic: "6732" },
  "nonprofit": { code: "813990", title: "Other Similar Organizations", sic: "8699" },
  "non-profit": { code: "813990", title: "Other Similar Organizations", sic: "8699" },
  "ngo": { code: "813990", title: "Other Similar Organizations", sic: "8699" },
};

// Validate a NAICS code (check format and if it's a real code)
function validateNAICS(code: string): { valid: boolean; normalized?: string } {
  if (!code) return { valid: false };
  
  // Remove any non-numeric characters
  const normalized = code.replace(/\D/g, '');
  
  // NAICS codes are 2-6 digits
  if (normalized.length < 2 || normalized.length > 6) {
    return { valid: false };
  }
  
  // Pad to 6 digits if shorter
  const padded = normalized.padEnd(6, '0');
  
  // First 2 digits must be valid sector (11-99)
  const sector = parseInt(padded.substring(0, 2));
  const validSectors = [11, 21, 22, 23, 31, 32, 33, 42, 44, 45, 48, 49, 51, 52, 53, 54, 55, 56, 61, 62, 71, 72, 81, 92];
  
  if (!validSectors.includes(sector)) {
    return { valid: false };
  }
  
  return { valid: true, normalized: padded };
}

// Lookup NAICS by industry name
function lookupByIndustry(industry: string): { code: string; title: string; sic?: string } | null {
  if (!industry) return null;
  
  const normalized = industry.toLowerCase().trim();
  
  // Direct match
  if (NAICS_DATABASE[normalized]) {
    return NAICS_DATABASE[normalized];
  }
  
  // Partial match - find best match
  for (const [key, value] of Object.entries(NAICS_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Word-based matching
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (word.length > 3 && NAICS_DATABASE[word]) {
      return NAICS_DATABASE[word];
    }
  }
  
  return null;
}

// AI inference for unknown industries
async function inferNAICS(industry: string): Promise<{ code: string; title: string; sic?: string; confidence: number } | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert in NAICS (North American Industry Classification System) codes.
Given an industry description, return the most appropriate 6-digit NAICS code.
Return ONLY a JSON object with: code (6-digit string), title (official NAICS title), sic (4-digit SIC code if known), confidence (0-100).`
          },
          {
            role: 'user',
            content: `What is the NAICS code for: "${industry}"?`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0.1
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      return {
        code: parsed.code,
        title: parsed.title,
        sic: parsed.sic,
        confidence: parsed.confidence || 70
      };
    }
  } catch (e) {
    console.error('[lookup-naics] AI inference error:', e);
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, industry, naics_code, batch } = await req.json();

    if (action === 'validate') {
      // Validate a NAICS code
      const result = validateNAICS(naics_code);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'lookup') {
      // Lookup by industry name
      let result = lookupByIndustry(industry);
      
      // If no direct match, try AI inference
      if (!result && industry) {
        const aiResult = await inferNAICS(industry);
        if (aiResult) {
          result = {
            code: aiResult.code,
            title: aiResult.title,
            sic: aiResult.sic
          };
        }
      }

      return new Response(
        JSON.stringify({
          found: !!result,
          ...result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'batch') {
      // Batch lookup for multiple industries
      const results: Record<string, any> = {};
      
      for (const item of batch || []) {
        const { id, industry: ind, naics_code: code } = item;
        
        if (code) {
          // Validate existing code
          const validation = validateNAICS(code);
          results[id] = { valid: validation.valid, code: validation.normalized };
        } else if (ind) {
          // Lookup by industry
          const lookup = lookupByIndustry(ind);
          results[id] = lookup ? { found: true, ...lookup } : { found: false };
        }
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: validate, lookup, or batch' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[lookup-naics] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
