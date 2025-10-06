import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ZoomInfo Industry Taxonomy (mirrored from frontend)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawIndustry, useAI = true } = await req.json();

    if (!rawIndustry) {
      throw new Error('rawIndustry is required');
    }

    console.log('Mapping industry:', rawIndustry);

    // Step 1: Try exact matching
    const exactMatch = tryExactMatch(rawIndustry);
    if (exactMatch) {
      console.log('Exact match found:', exactMatch);
      return new Response(
        JSON.stringify({ ...exactMatch, method: 'exact' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Try fuzzy matching
    const fuzzyMatch = tryFuzzyMatch(rawIndustry);
    if (fuzzyMatch && fuzzyMatch.confidence >= 0.7) {
      console.log('Fuzzy match found:', fuzzyMatch);
      return new Response(
        JSON.stringify({ ...fuzzyMatch, method: 'fuzzy' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Use AI for intelligent mapping (if enabled)
    if (useAI) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const aiMatch = await mapWithAI(rawIndustry, LOVABLE_API_KEY);
      console.log('AI match found:', aiMatch);
      return new Response(
        JSON.stringify({ ...aiMatch, method: 'ai' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No match found
    return new Response(
      JSON.stringify({ 
        primary_industry: null, 
        sub_industry: null, 
        confidence: 0,
        method: 'none'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in map-industry-to-zoominfo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function tryExactMatch(input: string) {
  const normalized = input.toLowerCase().trim();

  // Check primary industries
  for (const industry of ZOOMINFO_INDUSTRIES) {
    if (industry.primary.toLowerCase() === normalized) {
      return {
        primary_industry: industry.primary,
        sub_industry: null,
        confidence: 1.0
      };
    }
  }

  // Check sub-industries
  for (const industry of ZOOMINFO_INDUSTRIES) {
    for (const sub of industry.subIndustries) {
      if (sub.toLowerCase() === normalized) {
        return {
          primary_industry: industry.primary,
          sub_industry: sub,
          confidence: 1.0
        };
      }
    }
  }

  return null;
}

function tryFuzzyMatch(input: string) {
  const normalized = input.toLowerCase().trim();
  let bestMatch: { primary_industry: string; sub_industry: string | null; confidence: number } | null = null;

  // Partial match on primary
  for (const industry of ZOOMINFO_INDUSTRIES) {
    const primaryLower = industry.primary.toLowerCase();
    if (normalized.includes(primaryLower) || primaryLower.includes(normalized)) {
      const confidence = calculateSimilarity(normalized, primaryLower);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          primary_industry: industry.primary,
          sub_industry: null,
          confidence
        };
      }
    }

    // Partial match on sub-industry
    for (const sub of industry.subIndustries) {
      const subLower = sub.toLowerCase();
      if (normalized.includes(subLower) || subLower.includes(normalized)) {
        const confidence = calculateSimilarity(normalized, subLower) * 0.95; // Slight penalty for sub
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            primary_industry: industry.primary,
            sub_industry: sub,
            confidence
          };
        }
      }
    }
  }

  return bestMatch;
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 0.85;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

async function mapWithAI(rawIndustry: string, apiKey: string) {
  const primaryList = ZOOMINFO_INDUSTRIES.map(i => i.primary).join(', ');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: `Map the industry "${rawIndustry}" to the ZoomInfo taxonomy. Return ONLY the primary industry from this list: ${primaryList}. If confident about a sub-industry, also return it. Return confidence 0-1.`
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'map_industry',
          description: 'Map a raw industry string to ZoomInfo taxonomy',
          parameters: {
            type: 'object',
            properties: {
              primary_industry: { type: 'string', description: 'Primary industry from ZoomInfo taxonomy' },
              sub_industry: { type: 'string', nullable: true, description: 'Sub-industry if applicable' },
              confidence: { type: 'number', description: 'Confidence score 0-1' }
            },
            required: ['primary_industry', 'confidence'],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'map_industry' } }
    })
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    const args = JSON.parse(toolCall.function.arguments);
    return {
      primary_industry: args.primary_industry,
      sub_industry: args.sub_industry || null,
      confidence: Math.max(0.6, args.confidence) // AI mapping gets at least 0.6 confidence
    };
  }

  throw new Error('AI failed to map industry');
}
