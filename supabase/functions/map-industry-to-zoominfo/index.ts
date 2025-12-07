import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getModelConfig, buildHeaders, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ZoomInfo Industry Taxonomy
const ZOOMINFO_INDUSTRIES = [
  { primary: "Agriculture", subIndustries: ["Animals & Livestock", "Crops", "Forestry"] },
  { primary: "Business Services", subIndustries: ["Accounting Services", "Advertising & Marketing", "Call Centers & Business Centers", "Chambers of Commerce", "Commercial Printing", "Custom Software & IT Services", "Debt Collection", "Facilities Management & Commercial Cleaning", "Food Service", "HR & Staffing", "Information & Document Management", "Management Consulting", "Multimedia & Graphic Design", "Research & Development", "Security Products & Services", "Translation & Linguistic Services"] },
  { primary: "Construction", subIndustries: ["Architecture, Engineering & Design", "Civil Engineering Construction", "Commercial & Residential Construction"] },
  { primary: "Consumer Services", subIndustries: ["Automotive Service & Collision Repair", "Barber Shops & Beauty Salons", "Car & Truck Rental", "Childcare", "Cleaning Services", "Funeral Homes & Funeral Related Services", "Landscape Services", "Photography Studio", "Repair Services", "Weight & Health Management"] },
  { primary: "Education", subIndustries: ["Colleges & Universities", "K-12 Schools", "Training"] },
  { primary: "Energy, Utilities & Waste", subIndustries: ["Electricity, Oil & Gas", "Oil & Gas Exploration & Services", "Waste Treatment, Environmental Services & Recycling", "Water Treatment"] },
  { primary: "Finance", subIndustries: ["Banking", "Credit Cards & Transaction Processing", "Investment Banking", "Lending & Brokerage", "Venture Capital & Private Equity"] },
  { primary: "Government", subIndustries: ["Federal", "Local", "State", "Tribal Nations"] },
  { primary: "Healthcare Services", subIndustries: ["Ambulance Services", "Blood & Organ Banks", "Elderly Care Services", "Medical Laboratories & Imaging Centers", "Mental Health & Rehabilitation Facilities", "Veterinary Services"] },
  { primary: "Holding Companies & Conglomerates", subIndustries: [] },
  { primary: "Hospitals & Physicians Clinics", subIndustries: ["Dental Offices", "Medical & Surgical Hospitals", "Medical Specialists", "Physicians Clinics"] },
  { primary: "Hospitality", subIndustries: ["Amusement Parks, Arcades & Attractions", "Cultural & Informational Centers", "Fitness & Dance Facilities", "Gambling & Gaming", "Libraries", "Lodging & Resorts", "Movie Theaters", "Museums & Art Galleries", "Performing Arts Theaters", "Restaurants", "Sports Teams & Leagues", "Travel Agencies & Services", "Zoos & National Parks"] },
  { primary: "Insurance", subIndustries: [] },
  { primary: "Law Firms & Legal Services", subIndustries: [] },
  { primary: "Manufacturing", subIndustries: ["Aerospace & Defense", "Appliances", "Automotive Parts", "Boats & Submarines", "Building Materials", "Chemicals & Related Products", "Cleaning Products", "Computer Equipment & Peripherals", "Cosmetics, Beauty Supply & Personal Care Products", "Electronics", "Food & Beverage", "Furniture", "Glass & Clay", "Hand, Power & Lawn-care Tools", "Health & Nutrition Products", "Household Goods", "Industrial Machinery & Equipment", "Medical Devices & Equipment", "Motor Vehicles", "Pet Products", "Pharmaceuticals", "Photographic & Optical Equipment", "Plastic, Packaging & Containers", "Pulp & Paper", "Sporting Goods", "Telecommunication Equipment", "Test & Measurement Equipment", "Textiles & Apparel", "Tires & Rubber", "Toys & Games", "Watches & Jewelry", "Wire & Cable"] },
  { primary: "Media & Internet", subIndustries: ["Broadcasting", "Publishing", "Social Networks", "Newspapers & News Services", "Data Collection & Internet Portals", "Ticket Sales", "Music Production & Services"] },
  { primary: "Minerals & Mining", subIndustries: [] },
  { primary: "Organizations", subIndustries: ["Membership Organizations", "Non-Profit & Charitable Organizations", "Religious Organizations"] },
  { primary: "Real Estate", subIndustries: [] },
  { primary: "Retail", subIndustries: ["Apparel & Accessories Retail", "Auctions", "Automobile Dealers", "Automobile Parts Stores", "Consumer Electronics & Computers Retail", "Convenience Stores, Gas Stations & Liquor Stores", "Department Stores, Shopping Centers & Superstores", "Drug Stores & Pharmacies", "Flowers, Gifts & Specialty Stores", "Furniture", "Grocery Retail", "Home Improvement & Hardware Retail", "Jewelry & Watch Retail", "Office Products Retail & Distribution", "Other Rental Stores (Furniture, A/V, Construction & Industrial Equipment)", "Pet Products", "Record, Video & Book Stores", "Sporting & Recreational Equipment Retail", "Toys & Games", "Vitamins, Supplements & Health Stores"] },
  { primary: "Software", subIndustries: ["Business Intelligence (BI) Software", "Content & Collaboration Software", "Customer Relationship Management (CRM) Software", "Database & File Management Software", "Engineering Software", "Enterprise Resource Planning (ERP) Software", "Financial Software", "Healthcare Software", "Human Resources Software", "Legal Software", "Mobile App Development", "Multimedia, Games & Graphics Software", "Networking Software", "Security Software", "Storage & System Management Software", "Supply Chain Management (SCM) Software"] },
  { primary: "Telecommunications", subIndustries: ["Cable & Satellite", "Internet Service Providers, Website Hosting & Internet-related Services", "Telephony & Wireless"] },
  { primary: "Transportation", subIndustries: ["Airlines, Airports & Air Services", "Freight & Logistics Services", "Marine Shipping & Transportation", "Rail, Bus & Taxi", "Trucking, Moving & Storage"] }
];

// Multi-provider AI call with fallback
async function callAIWithFallback(messages: Array<{ role: string; content: string }>, tools?: any[], toolChoice?: any): Promise<any> {
  const providers = getAvailableProviders();
  
  for (const provider of providers) {
    try {
      const config = getModelConfig('analysis', provider);
      const headers = buildHeaders(provider);
      
      const body: any = { model: config.model, messages };
      body[config.maxTokensParam] = 500;
      if (tools) body.tools = tools;
      if (toolChoice) body.tool_choice = toolChoice;
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (response.ok) return await response.json();
      console.error(`[Industry Map] ${provider} error: ${response.status}`);
    } catch (error) {
      console.error(`[Industry Map] ${provider} failed:`, error);
    }
  }
  throw new Error('All AI providers failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawIndustry, useAI = true } = await req.json();
    if (!rawIndustry) throw new Error('rawIndustry is required');

    // Try exact/fuzzy matching first
    const exactMatch = tryExactMatch(rawIndustry);
    if (exactMatch) return new Response(JSON.stringify({ ...exactMatch, method: 'exact' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const fuzzyMatch = tryFuzzyMatch(rawIndustry);
    if (fuzzyMatch && fuzzyMatch.confidence >= 0.7) return new Response(JSON.stringify({ ...fuzzyMatch, method: 'fuzzy' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (useAI && getAvailableProviders().length > 0) {
      const primaryList = ZOOMINFO_INDUSTRIES.map(i => i.primary).join(', ');
      const aiData = await callAIWithFallback(
        [{ role: 'user', content: `Map the industry "${rawIndustry}" to the ZoomInfo taxonomy. Return ONLY the primary industry from this list: ${primaryList}. If confident about a sub-industry, also return it. Return confidence 0-1.` }],
        [{ type: 'function', function: { name: 'map_industry', parameters: { type: 'object', properties: { primary_industry: { type: 'string' }, sub_industry: { type: 'string', nullable: true }, confidence: { type: 'number' } }, required: ['primary_industry', 'confidence'] } } }],
        { type: 'function', function: { name: 'map_industry' } }
      );
      
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({ primary_industry: args.primary_industry, sub_industry: args.sub_industry || null, confidence: Math.max(0.6, args.confidence), method: 'ai' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ primary_industry: null, sub_industry: null, confidence: 0, method: 'none' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function tryExactMatch(input: string) {
  const normalized = input.toLowerCase().trim();
  for (const industry of ZOOMINFO_INDUSTRIES) {
    if (industry.primary.toLowerCase() === normalized) return { primary_industry: industry.primary, sub_industry: null, confidence: 1.0 };
    for (const sub of industry.subIndustries) {
      if (sub.toLowerCase() === normalized) return { primary_industry: industry.primary, sub_industry: sub, confidence: 1.0 };
    }
  }
  return null;
}

function tryFuzzyMatch(input: string) {
  const normalized = input.toLowerCase().trim();
  let bestMatch: any = null;
  for (const industry of ZOOMINFO_INDUSTRIES) {
    const primaryLower = industry.primary.toLowerCase();
    if (normalized.includes(primaryLower) || primaryLower.includes(normalized)) {
      const confidence = Math.min(normalized.length, primaryLower.length) / Math.max(normalized.length, primaryLower.length) * 0.85;
      if (!bestMatch || confidence > bestMatch.confidence) bestMatch = { primary_industry: industry.primary, sub_industry: null, confidence };
    }
  }
  return bestMatch;
}