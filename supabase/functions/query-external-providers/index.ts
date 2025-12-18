import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ICPCriteria {
  industries?: string[];
  employeeRanges?: string[];
  revenueRanges?: string[];
  countries?: string[];
  techStack?: string[];
  fundingStages?: string[];
}

interface ExternalSearchResult {
  provider: string;
  totalCount: number;
  segments: Array<{
    segment: string;
    count: number;
    sampleCompanies?: Array<{
      name: string;
      domain: string;
      industry: string;
      employeeCount: number;
    }>;
  }>;
  estimatedCost: number;
  searchCriteria: ICPCriteria;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId, icpCriteria, provider = 'pdl', limit = 100 } = await req.json();

    if (!orgId || !icpCriteria) {
      return new Response(
        JSON.stringify({ error: 'orgId and icpCriteria are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[query-external-providers] Querying ${provider} for org ${orgId}`);

    const criteria = icpCriteria as ICPCriteria;
    let result: ExternalSearchResult;

    // Check for API keys
    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    const clearbitApiKey = Deno.env.get('CLEARBIT_API_KEY');

    if (provider === 'pdl' && pdlApiKey) {
      // Query People Data Labs Company API
      result = await queryPDL(criteria, pdlApiKey, limit);
    } else if (provider === 'clearbit' && clearbitApiKey) {
      // Query Clearbit Prospector/Discovery API
      result = await queryClearbit(criteria, clearbitApiKey, limit);
    } else {
      // Return simulated data for demo/testing
      console.log(`[query-external-providers] No API key for ${provider}, returning simulated data`);
      result = simulateExternalQuery(criteria, provider, limit);
    }

    // Log the query for analytics
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      action: 'tam_external_query',
      actor: 'system',
      meta: {
        provider,
        criteria,
        totalCount: result.totalCount,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[query-external-providers] Found ${result.totalCount} companies matching criteria`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[query-external-providers] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function queryPDL(criteria: ICPCriteria, apiKey: string, limit: number): Promise<ExternalSearchResult> {
  const params = new URLSearchParams();
  
  // Build PDL query parameters
  if (criteria.industries?.length) {
    params.append('industry', criteria.industries.join(','));
  }
  if (criteria.countries?.length) {
    params.append('country', criteria.countries.join(','));
  }
  if (criteria.employeeRanges?.length) {
    // Convert ranges to PDL format
    const minMax = parseEmployeeRanges(criteria.employeeRanges);
    if (minMax.min) params.append('employee_count_min', minMax.min.toString());
    if (minMax.max) params.append('employee_count_max', minMax.max.toString());
  }
  
  params.append('size', limit.toString());

  try {
    const response = await fetch(`https://api.peopledatalabs.com/v5/company/search?${params}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PDL API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Group by industry for segments
    const industryGroups: Record<string, number> = {};
    const sampleCompanies: Array<{ name: string; domain: string; industry: string; employeeCount: number }> = [];
    
    for (const company of data.data || []) {
      const industry = company.industry || 'Other';
      industryGroups[industry] = (industryGroups[industry] || 0) + 1;
      
      if (sampleCompanies.length < 10) {
        sampleCompanies.push({
          name: company.name,
          domain: company.website,
          industry,
          employeeCount: company.employee_count,
        });
      }
    }

    return {
      provider: 'pdl',
      totalCount: data.total || 0,
      segments: Object.entries(industryGroups).map(([segment, count]) => ({
        segment,
        count,
        sampleCompanies: sampleCompanies.filter(c => c.industry === segment).slice(0, 3),
      })),
      estimatedCost: (data.total || 0) * 0.005,
      searchCriteria: criteria,
    };
  } catch (error) {
    console.error('[query-external-providers] PDL query failed:', error);
    throw error;
  }
}

async function queryClearbit(criteria: ICPCriteria, apiKey: string, limit: number): Promise<ExternalSearchResult> {
  // Clearbit Prospector API
  try {
    const body: Record<string, any> = {
      limit,
    };

    if (criteria.industries?.length) {
      body.industry = criteria.industries[0]; // Clearbit takes single industry
    }
    if (criteria.countries?.length) {
      body.country = criteria.countries[0];
    }

    const response = await fetch('https://prospector.clearbit.com/v1/companies/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Clearbit API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Process Clearbit response
    const industryGroups: Record<string, number> = {};
    const sampleCompanies: Array<{ name: string; domain: string; industry: string; employeeCount: number }> = [];

    for (const company of data.results || []) {
      const industry = company.industry || 'Other';
      industryGroups[industry] = (industryGroups[industry] || 0) + 1;
      
      if (sampleCompanies.length < 10) {
        sampleCompanies.push({
          name: company.name,
          domain: company.domain,
          industry,
          employeeCount: company.metrics?.employees || 0,
        });
      }
    }

    return {
      provider: 'clearbit',
      totalCount: data.total || data.results?.length || 0,
      segments: Object.entries(industryGroups).map(([segment, count]) => ({
        segment,
        count,
        sampleCompanies: sampleCompanies.filter(c => c.industry === segment).slice(0, 3),
      })),
      estimatedCost: (data.total || 0) * 0.001,
      searchCriteria: criteria,
    };
  } catch (error) {
    console.error('[query-external-providers] Clearbit query failed:', error);
    throw error;
  }
}

function simulateExternalQuery(criteria: ICPCriteria, provider: string, limit: number): ExternalSearchResult {
  // Generate realistic-looking simulated data for demo purposes
  const industries = criteria.industries || ['Technology', 'Healthcare', 'Finance'];
  const baseCount = Math.floor(Math.random() * 10000) + 1000;

  const segments = industries.map(industry => ({
    segment: industry,
    count: Math.floor(baseCount * (0.2 + Math.random() * 0.3)),
    sampleCompanies: [
      {
        name: `${industry} Corp`,
        domain: `${industry.toLowerCase().replace(/\s/g, '')}.com`,
        industry,
        employeeCount: Math.floor(Math.random() * 5000) + 50,
      },
      {
        name: `${industry} Solutions Inc`,
        domain: `${industry.toLowerCase().replace(/\s/g, '')}solutions.com`,
        industry,
        employeeCount: Math.floor(Math.random() * 2000) + 100,
      },
    ],
  }));

  const totalCount = segments.reduce((sum, s) => sum + s.count, 0);
  const costPerRecord = provider === 'pdl' ? 0.005 : 0.001;

  return {
    provider,
    totalCount,
    segments,
    estimatedCost: Math.min(totalCount, limit) * costPerRecord,
    searchCriteria: criteria,
  };
}

function parseEmployeeRanges(ranges: string[]): { min?: number; max?: number } {
  let min: number | undefined;
  let max: number | undefined;

  for (const range of ranges) {
    const match = range.match(/(\d+)-(\d+)/);
    if (match) {
      const rangeMin = parseInt(match[1]);
      const rangeMax = parseInt(match[2]);
      if (!min || rangeMin < min) min = rangeMin;
      if (!max || rangeMax > max) max = rangeMax;
    } else if (range.includes('+')) {
      const numMatch = range.match(/(\d+)/);
      if (numMatch) {
        const rangeMin = parseInt(numMatch[1]);
        if (!min || rangeMin < min) min = rangeMin;
      }
    }
  }

  return { min, max };
}
