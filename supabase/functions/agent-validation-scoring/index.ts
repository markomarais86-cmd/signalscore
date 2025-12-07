// Enhanced Validation & Scoring Agent - Eugene's 0/1/2 field scoring
// Compares original data with enriched data and assigns quality scores
// Migrated to use centralized AI config with OpenAI as primary

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  raw_input: any;
  enriched_data: any;
  record_type: 'account' | 'lead';
  icp_criteria?: {
    min_employee_count?: number;
    min_revenue?: string;
    target_titles?: string[];
    target_industries?: string[];
    target_countries?: string[];
  };
}

// Eugene's scoring system prompt
const SYSTEM_PROMPT = `You are a data validation and scoring agent using the 0/1/2 scoring system.

=== SCORING RULES (Per Field) ===
- Score 2: Value was PROVIDED in original AND MATCHES what was FOUND (verified match)
- Score 1: Value was NOT provided but was FOUND, OR value was provided but is DIFFERENT than found
- Score 0: Value was NOT provided AND was NOT found

=== FIELDS TO SCORE ===
For accounts: name, industry, employee_count, revenue, geography (city/state/country), website, linkedin, facebook, phone
For contacts: name, email, phone, title, company, linkedin, facebook, location

=== ICP PASS/FAIL DETERMINATION ===
A record PASSES ICP if it meets ALL criteria provided:
- Min employee count (if specified)
- Min revenue (if specified)
- Target titles (contact must have one of the specified titles)
- Target industries (company must be in one of the specified industries)
- Target countries (must be in one of the specified countries)

If ANY criterion fails, the record FAILS ICP. List all fail reasons.

=== VALIDATION CHECKS ===
1. Name consistency (enriched matches or improves original)
2. Domain verification (company domain matches email domain for contacts)
3. Data freshness (recent verification signals)
4. Cross-reference accuracy (multiple sources agree)
5. Format correctness (phone, email, URL formats)

=== FLAG ANOMALIES ===
- Domain mismatch (email domain vs company website)
- Title inconsistency
- Geographic mismatch
- Stale data indicators (company acquired, person moved)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { raw_input, enriched_data, record_type, icp_criteria }: ValidationRequest = await req.json();
    
    console.log(`[ValidationAgent] Validating ${record_type} with 0/1/2 scoring`);
    console.log(`[ValidationAgent] ICP criteria:`, JSON.stringify(icp_criteria));

    const providers = getAvailableProviders();
    
    // If no AI providers, fall back to programmatic scoring
    if (providers.length === 0) {
      console.log('[ValidationAgent] No AI provider, using programmatic scoring');
      const result = performEnhancedScoring(raw_input, enriched_data, record_type, icp_criteria);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = buildValidationPrompt(raw_input, enriched_data, record_type, icp_criteria);

    const response = await callAI('analysis', [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], {
      tools: [
        {
          type: 'function',
          function: {
            name: 'return_validation_result',
            description: 'Return the 0/1/2 field scores, ICP pass/fail, and validated data',
            parameters: getValidationSchema()
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'return_validation_result' } }
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        console.warn('[ValidationAgent] Rate limited or out of credits, using programmatic scoring');
        const result = performEnhancedScoring(raw_input, enriched_data, record_type, icp_criteria);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    
    const mergedData = { ...raw_input, ...enriched_data };
    
    let validationResult = performEnhancedScoring(raw_input, enriched_data, record_type, icp_criteria);

    try {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        validationResult = {
          ...parsed,
          validated_data: parsed.validated_data && Object.keys(parsed.validated_data).length > 0 
            ? { ...mergedData, ...parsed.validated_data }
            : mergedData
        };
      }
    } catch (parseError) {
      console.error('[ValidationAgent] Failed to parse AI response, using programmatic scoring:', parseError);
    }
    
    console.log(`[ValidationAgent] Field scores:`, JSON.stringify(validationResult.field_scores));
    console.log(`[ValidationAgent] Total score: ${validationResult.total_score}, ICP Pass: ${validationResult.icp_pass}`);

    return new Response(JSON.stringify({
      success: true,
      ...validationResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ValidationAgent] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getValidationSchema(): any {
  return {
    type: 'object',
    properties: {
      field_scores: {
        type: 'object',
        description: 'Score (0/1/2) for each field using Eugene scoring system',
        properties: {
          name_score: { type: 'number', minimum: 0, maximum: 2 },
          company_score: { type: 'number', minimum: 0, maximum: 2 },
          email_score: { type: 'number', minimum: 0, maximum: 2 },
          phone_score: { type: 'number', minimum: 0, maximum: 2 },
          website_score: { type: 'number', minimum: 0, maximum: 2 },
          linkedin_score: { type: 'number', minimum: 0, maximum: 2 },
          facebook_score: { type: 'number', minimum: 0, maximum: 2 },
          title_score: { type: 'number', minimum: 0, maximum: 2 },
          industry_score: { type: 'number', minimum: 0, maximum: 2 },
          geography_score: { type: 'number', minimum: 0, maximum: 2 },
          size_score: { type: 'number', minimum: 0, maximum: 2 },
          revenue_score: { type: 'number', minimum: 0, maximum: 2 }
        }
      },
      total_score: { type: 'number', description: 'Sum of all field scores' },
      max_possible_score: { type: 'number', description: 'Maximum possible score (num_fields * 2)' },
      confidence: { 
        type: 'string', 
        enum: ['high', 'medium', 'low'],
        description: 'high if score >= 70%, medium if >= 40%, low otherwise' 
      },
      icp_pass: { type: 'boolean', description: 'Whether record meets ICP criteria' },
      icp_fail_reasons: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of ICP criteria that failed'
      },
      validation_summary: { type: 'string', description: 'Summary of found vs not found fields' },
      anomalies: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of detected anomalies or concerns'
      },
      validated_data: { type: 'object', description: 'The validated/merged data object with corrections' }
    },
    required: ['field_scores', 'total_score', 'confidence', 'icp_pass', 'validation_summary']
  };
}

function buildValidationPrompt(rawInput: any, enrichedData: any, recordType: string, icpCriteria?: any): string {
  return `Validate and score this ${recordType} enrichment using 0/1/2 scoring:

=== ORIGINAL DATA (What we started with) ===
${JSON.stringify(rawInput, null, 2)}

=== ENRICHED DATA (What we found) ===
${JSON.stringify(enrichedData, null, 2)}

=== ICP CRITERIA (Must pass ALL to be ICP qualified) ===
${icpCriteria ? JSON.stringify(icpCriteria, null, 2) : 'No specific ICP criteria provided - default pass'}

=== TASKS ===
1. Score each field using 0/1/2 system
2. Calculate total_score = sum of all field scores
3. Calculate max_possible_score = number of scored fields * 2
4. Determine confidence based on score percentage
5. Determine ICP pass/fail
6. Create validation_summary
7. List any anomalies
8. Return validated_data with merged and corrected values

Use the return_validation_result function.`;
}

// Enhanced programmatic scoring with Eugene's 0/1/2 system
function performEnhancedScoring(rawInput: any, enrichedData: any, recordType: string, icpCriteria?: any): any {
  const fieldScores: any = {};
  
  const fieldsConfig = recordType === 'account' 
    ? {
        name: { raw: ['name', 'company_name'], enriched: ['company_name', 'name'] },
        industry: { raw: ['industry', 'industry_raw'], enriched: ['industry', 'company_industry'] },
        size: { raw: ['employee_count'], enriched: ['employee_count', 'company_employee_count'] },
        revenue: { raw: ['revenue_range'], enriched: ['revenue_range', 'company_annual_revenue'] },
        geography: { raw: ['country', 'city', 'state'], enriched: ['hq_country', 'country', 'hq_city', 'city'] },
        website: { raw: ['domain', 'website'], enriched: ['domain', 'company_website', 'website'] },
        linkedin: { raw: ['linkedin_url'], enriched: ['linkedin_url', 'company_linkedin_url'] },
        facebook: { raw: ['facebook_url'], enriched: ['facebook_url', 'company_facebook_url'] },
        phone: { raw: ['phone', 'company_main_phone'], enriched: ['company_main_phone', 'phone'] }
      }
    : {
        name: { raw: ['first_name', 'last_name', 'name'], enriched: ['first_name', 'last_name'] },
        email: { raw: ['email'], enriched: ['email'] },
        phone: { raw: ['phone', 'mobile', 'cell_phone'], enriched: ['phone_number', 'cell_phone', 'direct_phone', 'phone'] },
        title: { raw: ['title', 'title_raw'], enriched: ['current_title', 'title'] },
        company: { raw: ['company'], enriched: ['current_company', 'company'] },
        linkedin: { raw: ['linkedin_url'], enriched: ['linkedin_url'] },
        facebook: { raw: ['facebook_url'], enriched: ['facebook_url'] },
        geography: { raw: ['country', 'city', 'state'], enriched: ['current_country', 'current_city', 'country', 'city'] },
        website: { raw: ['domain', 'website'], enriched: ['company_website', 'domain'] }
      };

  let totalScore = 0;
  const foundFields: string[] = [];
  const missingFields: string[] = [];

  for (const [fieldName, config] of Object.entries(fieldsConfig)) {
    const score = scoreField(rawInput, enrichedData, config.raw, config.enriched);
    fieldScores[`${fieldName}_score`] = score;
    totalScore += score;
    
    if (score >= 1) {
      foundFields.push(fieldName);
    } else {
      missingFields.push(fieldName);
    }
  }

  const maxScore = Object.keys(fieldsConfig).length * 2;
  const scorePercentage = totalScore / maxScore;
  
  const confidence = scorePercentage >= 0.7 ? 'high' : scorePercentage >= 0.4 ? 'medium' : 'low';
  const icpResult = checkIcpCriteria(enrichedData, icpCriteria);
  const validationSummary = `Found: ${foundFields.join(', ') || 'none'}. Missing: ${missingFields.join(', ') || 'none'}. Score: ${totalScore}/${maxScore} (${Math.round(scorePercentage * 100)}%)`;

  return {
    field_scores: fieldScores,
    total_score: totalScore,
    max_possible_score: maxScore,
    overall_score: totalScore,
    confidence,
    icp_pass: icpResult.pass,
    icp_fail_reasons: icpResult.failReasons,
    validation_summary: validationSummary,
    anomalies: detectAnomalies(rawInput, enrichedData, recordType),
    validated_data: { ...rawInput, ...enrichedData }
  };
}

function scoreField(rawInput: any, enrichedData: any, rawKeys: string[], enrichedKeys: string[]): number {
  let rawValue: any = null;
  for (const key of rawKeys) {
    if (rawInput[key] && rawInput[key] !== '' && rawInput[key] !== 'Unknown') {
      rawValue = rawInput[key];
      break;
    }
  }

  let enrichedValue: any = null;
  for (const key of enrichedKeys) {
    if (enrichedData[key] && enrichedData[key] !== '' && enrichedData[key] !== 'Unknown') {
      enrichedValue = enrichedData[key];
      break;
    }
  }

  if (rawValue && enrichedValue) {
    const rawNorm = String(rawValue).toLowerCase().trim();
    const enrichedNorm = String(enrichedValue).toLowerCase().trim();
    
    if (rawNorm === enrichedNorm || enrichedNorm.includes(rawNorm) || rawNorm.includes(enrichedNorm)) {
      return 2;
    }
    return 1;
  } else if (!rawValue && enrichedValue) {
    return 1;
  } else {
    return 0;
  }
}

function checkIcpCriteria(enrichedData: any, criteria?: any): { pass: boolean; failReasons: string[] } {
  if (!criteria) {
    return { pass: true, failReasons: [] };
  }

  const failReasons: string[] = [];

  if (criteria.min_employee_count) {
    const empCount = enrichedData.employee_count || enrichedData.company_employee_count || 0;
    if (empCount < criteria.min_employee_count) {
      failReasons.push(`Employee count ${empCount} < minimum ${criteria.min_employee_count}`);
    }
  }

  if (criteria.min_revenue) {
    const revenue = enrichedData.revenue_range || enrichedData.company_annual_revenue || '';
    const minRevNum = parseRevenueToNumber(criteria.min_revenue);
    const actualRevNum = parseRevenueToNumber(revenue);
    
    if (actualRevNum < minRevNum) {
      failReasons.push(`Revenue ${revenue || 'unknown'} < minimum ${criteria.min_revenue}`);
    }
  }

  if (criteria.target_titles && criteria.target_titles.length > 0) {
    const title = (enrichedData.current_title || enrichedData.title || '').toLowerCase();
    const hasTargetTitle = criteria.target_titles.some((t: string) => title.includes(t.toLowerCase()));
    
    if (!hasTargetTitle && title) {
      failReasons.push(`Title "${enrichedData.current_title || enrichedData.title}" not in target titles`);
    }
  }

  if (criteria.target_industries && criteria.target_industries.length > 0) {
    const industry = (enrichedData.industry || enrichedData.company_industry || '').toLowerCase();
    const hasTargetIndustry = criteria.target_industries.some((i: string) => industry.includes(i.toLowerCase()));
    
    if (!hasTargetIndustry && industry) {
      failReasons.push(`Industry "${enrichedData.industry || enrichedData.company_industry}" not in target industries`);
    }
  }

  if (criteria.target_countries && criteria.target_countries.length > 0) {
    const country = (enrichedData.current_country || enrichedData.country || enrichedData.hq_country || '').toLowerCase();
    const hasTargetCountry = criteria.target_countries.some((c: string) => country.includes(c.toLowerCase()));
    
    if (!hasTargetCountry && country) {
      failReasons.push(`Country "${country}" not in target countries`);
    }
  }

  return { pass: failReasons.length === 0, failReasons };
}

function parseRevenueToNumber(revenue: string): number {
  if (!revenue) return 0;
  
  const lower = revenue.toLowerCase();
  const numMatch = lower.match(/[\d.]+/);
  if (!numMatch) return 0;
  
  let num = parseFloat(numMatch[0]);
  
  if (lower.includes('b')) num *= 1_000_000_000;
  else if (lower.includes('m')) num *= 1_000_000;
  else if (lower.includes('k')) num *= 1_000;
  
  return num;
}

function detectAnomalies(rawInput: any, enrichedData: any, recordType: string): string[] {
  const anomalies: string[] = [];

  if (recordType === 'lead') {
    const email = enrichedData.email || rawInput.email || '';
    const companyDomain = enrichedData.company_website || enrichedData.domain || rawInput.domain || '';
    
    if (email && companyDomain) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      const domainClean = companyDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      
      if (emailDomain && domainClean && !domainClean.includes(emailDomain) && !emailDomain.includes(domainClean)) {
        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
        if (personalDomains.includes(emailDomain)) {
          anomalies.push(`Personal email domain (${emailDomain}) - may not be business email`);
        } else {
          anomalies.push(`Email domain mismatch: ${emailDomain} vs company ${domainClean}`);
        }
      }
    }

    if (enrichedData.still_at_company === 'no') {
      anomalies.push('Contact may have left this company');
    }
  }

  return anomalies;
}
