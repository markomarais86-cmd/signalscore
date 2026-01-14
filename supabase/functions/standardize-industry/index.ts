import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ZoomInfo Industry Taxonomy (subset for matching)
const ZOOMINFO_INDUSTRIES = [
  { primary: "Software", subIndustries: ["Enterprise Software", "SaaS", "Cloud Computing", "Cybersecurity", "Data Analytics", "Artificial Intelligence", "DevOps", "Mobile Applications"] },
  { primary: "Information Technology", subIndustries: ["IT Services", "IT Consulting", "Managed Services", "Systems Integration", "Technical Support"] },
  { primary: "Financial Services", subIndustries: ["Banking", "Investment Banking", "Asset Management", "Insurance", "FinTech", "Payments", "Wealth Management", "Private Equity", "Venture Capital"] },
  { primary: "Healthcare", subIndustries: ["Hospitals", "Medical Devices", "Pharmaceuticals", "Biotechnology", "Health Insurance", "Telemedicine", "Clinical Research", "Healthcare IT"] },
  { primary: "Manufacturing", subIndustries: ["Industrial Manufacturing", "Electronics Manufacturing", "Automotive Manufacturing", "Aerospace Manufacturing", "Consumer Goods Manufacturing", "Food Manufacturing"] },
  { primary: "Retail", subIndustries: ["E-commerce", "Consumer Electronics", "Fashion Retail", "Grocery", "Department Stores", "Specialty Retail"] },
  { primary: "Telecommunications", subIndustries: ["Wireless", "Internet Service Providers", "Cable", "Satellite", "VoIP", "Network Equipment"] },
  { primary: "Energy", subIndustries: ["Oil & Gas", "Renewable Energy", "Utilities", "Solar", "Wind", "Nuclear", "Energy Storage"] },
  { primary: "Professional Services", subIndustries: ["Consulting", "Legal Services", "Accounting", "Marketing Services", "HR Services", "Staffing", "Training"] },
  { primary: "Media & Entertainment", subIndustries: ["Broadcasting", "Publishing", "Streaming", "Gaming", "Advertising", "Film Production", "Music"] },
  { primary: "Education", subIndustries: ["Higher Education", "K-12", "EdTech", "Corporate Training", "Online Learning", "Test Preparation"] },
  { primary: "Real Estate", subIndustries: ["Commercial Real Estate", "Residential Real Estate", "Property Management", "Real Estate Investment", "Construction"] },
  { primary: "Transportation & Logistics", subIndustries: ["Shipping", "Freight", "Airlines", "Rail", "Trucking", "Warehousing", "Supply Chain"] },
  { primary: "Hospitality", subIndustries: ["Hotels", "Restaurants", "Travel", "Tourism", "Event Management", "Food Service"] },
  { primary: "Government", subIndustries: ["Federal Government", "State Government", "Local Government", "Defense", "Public Safety"] },
  { primary: "Non-Profit", subIndustries: ["Charities", "Foundations", "NGOs", "Religious Organizations", "Trade Associations"] },
  { primary: "Agriculture", subIndustries: ["Farming", "AgTech", "Food Processing", "Livestock", "Agricultural Equipment"] },
  { primary: "Aerospace & Defense", subIndustries: ["Aircraft", "Defense Systems", "Space", "Military Equipment", "Aviation Services"] },
  { primary: "Automotive", subIndustries: ["Auto Manufacturing", "Auto Parts", "Electric Vehicles", "Auto Dealers", "Auto Services"] },
  { primary: "Consumer Goods", subIndustries: ["CPG", "Personal Care", "Household Products", "Food & Beverage", "Apparel"] },
  { primary: "Construction", subIndustries: ["Commercial Construction", "Residential Construction", "Infrastructure", "Engineering", "Architecture"] },
  { primary: "Chemicals", subIndustries: ["Specialty Chemicals", "Industrial Chemicals", "Petrochemicals", "Agricultural Chemicals"] },
  { primary: "Life Sciences", subIndustries: ["Biotech", "Pharmaceuticals", "Medical Research", "Genomics", "Drug Development"] },
];

function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function tryExactMatch(input: string): { primary: string; sub: string | null; confidence: number } | null {
  const normalized = normalizeString(input);
  
  for (const industry of ZOOMINFO_INDUSTRIES) {
    // Check primary industry
    if (normalizeString(industry.primary) === normalized) {
      return { primary: industry.primary, sub: null, confidence: 1.0 };
    }
    
    // Check sub-industries
    for (const sub of industry.subIndustries) {
      if (normalizeString(sub) === normalized) {
        return { primary: industry.primary, sub, confidence: 1.0 };
      }
    }
  }
  
  return null;
}

function tryFuzzyMatch(input: string): { primary: string; sub: string | null; confidence: number } | null {
  const normalized = normalizeString(input);
  let bestMatch: { primary: string; sub: string | null; confidence: number } | null = null;
  
  for (const industry of ZOOMINFO_INDUSTRIES) {
    // Check if input contains primary or vice versa
    const primaryNorm = normalizeString(industry.primary);
    
    if (normalized.includes(primaryNorm) || primaryNorm.includes(normalized)) {
      const confidence = Math.min(normalized.length, primaryNorm.length) / Math.max(normalized.length, primaryNorm.length);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { primary: industry.primary, sub: null, confidence: Math.min(confidence + 0.1, 0.95) };
      }
    }
    
    // Check sub-industries
    for (const sub of industry.subIndustries) {
      const subNorm = normalizeString(sub);
      
      if (normalized.includes(subNorm) || subNorm.includes(normalized)) {
        const confidence = Math.min(normalized.length, subNorm.length) / Math.max(normalized.length, subNorm.length);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { primary: industry.primary, sub, confidence: Math.min(confidence + 0.1, 0.95) };
        }
      }
    }
  }
  
  // Only return if confidence is above threshold
  if (bestMatch && bestMatch.confidence >= 0.5) {
    return bestMatch;
  }
  
  return null;
}

// Keyword-based matching for common terms
function tryKeywordMatch(input: string): { primary: string; sub: string | null; confidence: number } | null {
  const normalized = normalizeString(input);
  
  const keywordMap: Record<string, { primary: string; sub: string | null }> = {
    'saas': { primary: 'Software', sub: 'SaaS' },
    'cloud': { primary: 'Software', sub: 'Cloud Computing' },
    'ai': { primary: 'Software', sub: 'Artificial Intelligence' },
    'artificial intelligence': { primary: 'Software', sub: 'Artificial Intelligence' },
    'machine learning': { primary: 'Software', sub: 'Artificial Intelligence' },
    'ml': { primary: 'Software', sub: 'Artificial Intelligence' },
    'cyber': { primary: 'Software', sub: 'Cybersecurity' },
    'security': { primary: 'Software', sub: 'Cybersecurity' },
    'fintech': { primary: 'Financial Services', sub: 'FinTech' },
    'bank': { primary: 'Financial Services', sub: 'Banking' },
    'insur': { primary: 'Financial Services', sub: 'Insurance' },
    'invest': { primary: 'Financial Services', sub: 'Investment Banking' },
    'hospital': { primary: 'Healthcare', sub: 'Hospitals' },
    'medical': { primary: 'Healthcare', sub: 'Medical Devices' },
    'pharma': { primary: 'Healthcare', sub: 'Pharmaceuticals' },
    'biotech': { primary: 'Life Sciences', sub: 'Biotech' },
    'ecommerce': { primary: 'Retail', sub: 'E-commerce' },
    'e-commerce': { primary: 'Retail', sub: 'E-commerce' },
    'online store': { primary: 'Retail', sub: 'E-commerce' },
    'telecom': { primary: 'Telecommunications', sub: null },
    'wireless': { primary: 'Telecommunications', sub: 'Wireless' },
    'internet provider': { primary: 'Telecommunications', sub: 'Internet Service Providers' },
    'solar': { primary: 'Energy', sub: 'Solar' },
    'renewable': { primary: 'Energy', sub: 'Renewable Energy' },
    'oil': { primary: 'Energy', sub: 'Oil & Gas' },
    'gas': { primary: 'Energy', sub: 'Oil & Gas' },
    'consult': { primary: 'Professional Services', sub: 'Consulting' },
    'legal': { primary: 'Professional Services', sub: 'Legal Services' },
    'law firm': { primary: 'Professional Services', sub: 'Legal Services' },
    'account': { primary: 'Professional Services', sub: 'Accounting' },
    'market': { primary: 'Professional Services', sub: 'Marketing Services' },
    'advertis': { primary: 'Media & Entertainment', sub: 'Advertising' },
    'gaming': { primary: 'Media & Entertainment', sub: 'Gaming' },
    'video game': { primary: 'Media & Entertainment', sub: 'Gaming' },
    'stream': { primary: 'Media & Entertainment', sub: 'Streaming' },
    'university': { primary: 'Education', sub: 'Higher Education' },
    'college': { primary: 'Education', sub: 'Higher Education' },
    'school': { primary: 'Education', sub: 'K-12' },
    'edtech': { primary: 'Education', sub: 'EdTech' },
    'hotel': { primary: 'Hospitality', sub: 'Hotels' },
    'restaurant': { primary: 'Hospitality', sub: 'Restaurants' },
    'travel': { primary: 'Hospitality', sub: 'Travel' },
    'logistics': { primary: 'Transportation & Logistics', sub: 'Supply Chain' },
    'shipping': { primary: 'Transportation & Logistics', sub: 'Shipping' },
    'freight': { primary: 'Transportation & Logistics', sub: 'Freight' },
    'warehouse': { primary: 'Transportation & Logistics', sub: 'Warehousing' },
    'real estate': { primary: 'Real Estate', sub: null },
    'property': { primary: 'Real Estate', sub: 'Property Management' },
    'construction': { primary: 'Construction', sub: null },
    'building': { primary: 'Construction', sub: null },
    'automotive': { primary: 'Automotive', sub: null },
    'car': { primary: 'Automotive', sub: null },
    'vehicle': { primary: 'Automotive', sub: null },
    'electric vehicle': { primary: 'Automotive', sub: 'Electric Vehicles' },
    'ev': { primary: 'Automotive', sub: 'Electric Vehicles' },
    'aerospace': { primary: 'Aerospace & Defense', sub: null },
    'defense': { primary: 'Aerospace & Defense', sub: 'Defense Systems' },
    'military': { primary: 'Aerospace & Defense', sub: 'Military Equipment' },
    'government': { primary: 'Government', sub: null },
    'federal': { primary: 'Government', sub: 'Federal Government' },
    'nonprofit': { primary: 'Non-Profit', sub: null },
    'non-profit': { primary: 'Non-Profit', sub: null },
    'charity': { primary: 'Non-Profit', sub: 'Charities' },
    'ngo': { primary: 'Non-Profit', sub: 'NGOs' },
    'agriculture': { primary: 'Agriculture', sub: null },
    'farming': { primary: 'Agriculture', sub: 'Farming' },
    'agtech': { primary: 'Agriculture', sub: 'AgTech' },
  };
  
  for (const [keyword, match] of Object.entries(keywordMap)) {
    if (normalized.includes(keyword)) {
      return { ...match, confidence: 0.8 };
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
        JSON.stringify({ 
          industry_norm: null, 
          sub_industry: null, 
          confidence: 0,
          method: 'none',
          error: 'Invalid or missing industry_raw parameter' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try matching strategies in order
    let result = tryExactMatch(industry_raw);
    let method = 'exact';
    
    if (!result) {
      result = tryFuzzyMatch(industry_raw);
      method = 'fuzzy';
    }
    
    if (!result) {
      result = tryKeywordMatch(industry_raw);
      method = 'keyword';
    }
    
    if (result) {
      return new Response(
        JSON.stringify({
          industry_norm: result.primary,
          sub_industry: result.sub,
          confidence: result.confidence,
          method
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No match found
    return new Response(
      JSON.stringify({
        industry_norm: null,
        sub_industry: null,
        confidence: 0,
        method: 'none'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in standardize-industry:', error);
    return new Response(
      JSON.stringify({ 
        industry_norm: null, 
        sub_industry: null,
        confidence: 0,
        method: 'error',
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
