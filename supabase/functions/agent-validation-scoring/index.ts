import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  raw_input: any;
  enriched_data: any;
  record_type: 'account' | 'lead';
}

const SYSTEM_PROMPT = `You are a data validation and scoring agent.
Your job is to compare original data with enriched data and assign quality scores.

SCORING RULES (0-2 per field):
- 0 = Missing or clearly incorrect
- 1 = Present but unverified or partially correct
- 2 = Present and verified/high confidence

FIELDS TO SCORE:
For accounts: company_name, industry, employee_count, revenue, geography, website, linkedin
For contacts: name, email, phone, title, company, linkedin, location

VALIDATION CHECKS:
1. Name consistency (enriched matches or improves original)
2. Domain verification (company domain matches email domain for contacts)
3. Data freshness (recent verification signals)
4. Cross-reference accuracy (multiple sources agree)
5. Format correctness (phone, email, URL formats)

FLAG ANOMALIES:
- Domain mismatch (email domain vs company website)
- Title inconsistency (junior title at C-level company?)
- Geographic mismatch (contact location vs company HQ)
- Stale data indicators (company acquired, person moved)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { raw_input, enriched_data, record_type }: ValidationRequest = await req.json();
    
    console.log(`[ValidationAgent] Validating ${record_type} data`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = buildValidationPrompt(raw_input, enriched_data, record_type);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_validation_result',
              description: 'Return the validation scores and summary',
              parameters: {
                type: 'object',
                properties: {
                  field_scores: {
                    type: 'object',
                    description: 'Score (0-2) for each field',
                    properties: {
                      name_score: { type: 'number', minimum: 0, maximum: 2 },
                      company_score: { type: 'number', minimum: 0, maximum: 2 },
                      email_score: { type: 'number', minimum: 0, maximum: 2 },
                      phone_score: { type: 'number', minimum: 0, maximum: 2 },
                      website_score: { type: 'number', minimum: 0, maximum: 2 },
                      linkedin_score: { type: 'number', minimum: 0, maximum: 2 },
                      title_score: { type: 'number', minimum: 0, maximum: 2 },
                      industry_score: { type: 'number', minimum: 0, maximum: 2 },
                      geography_score: { type: 'number', minimum: 0, maximum: 2 },
                      size_score: { type: 'number', minimum: 0, maximum: 2 },
                      revenue_score: { type: 'number', minimum: 0, maximum: 2 }
                    }
                  },
                  overall_score: { 
                    type: 'number', 
                    description: 'Sum of all field scores (0-22 max)' 
                  },
                  confidence: { 
                    type: 'string', 
                    enum: ['high', 'medium', 'low'],
                    description: 'Overall confidence based on scores and verification' 
                  },
                  validation_summary: { 
                    type: 'string', 
                    description: 'Brief summary of data quality and any anomalies' 
                  },
                  anomalies: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of detected anomalies or concerns'
                  },
                  validated_data: {
                    type: 'object',
                    description: 'The validated/corrected data object'
                  }
                },
                required: ['field_scores', 'overall_score', 'confidence', 'validation_summary']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_validation_result' } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    
    // Default to merged data
    const mergedData = { ...raw_input, ...enriched_data };
    
    let validationResult = {
      field_scores: {},
      overall_score: 0,
      confidence: 'low',
      validation_summary: 'Validation failed',
      anomalies: [],
      validated_data: mergedData
    };

    try {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        validationResult = {
          ...parsed,
          // Always ensure validated_data contains merged data
          validated_data: parsed.validated_data && Object.keys(parsed.validated_data).length > 0 
            ? { ...mergedData, ...parsed.validated_data }
            : mergedData
        };
      }
    } catch (parseError) {
      console.error('[ValidationAgent] Failed to parse AI response:', parseError);
      // Fall back to basic scoring
      validationResult = performBasicScoring(raw_input, enriched_data, record_type);
    }
    
    console.log(`[ValidationAgent] Returning validated_data with title: ${validationResult.validated_data?.title}`);

    console.log(`[ValidationAgent] Scores:`, JSON.stringify(validationResult.field_scores));
    console.log(`[ValidationAgent] Overall: ${validationResult.overall_score}, Confidence: ${validationResult.confidence}`);

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

function buildValidationPrompt(rawInput: any, enrichedData: any, recordType: string): string {
  return `Validate and score this ${recordType} enrichment:

ORIGINAL DATA:
${JSON.stringify(rawInput, null, 2)}

ENRICHED DATA:
${JSON.stringify(enrichedData, null, 2)}

Tasks:
1. Compare each field between original and enriched
2. Assign a score (0-2) for each relevant field
3. Calculate overall_score as sum of all field scores
4. Determine confidence level:
   - high: overall_score >= 15 AND no major anomalies
   - medium: overall_score >= 8 OR some verified fields
   - low: overall_score < 8 OR major anomalies
5. Write a brief validation_summary
6. List any anomalies detected
7. Return the validated_data (enriched data with any corrections)

Use the return_validation_result function with your analysis.`;
}

function performBasicScoring(rawInput: any, enrichedData: any, recordType: string): any {
  const fieldScores: any = {};
  let totalScore = 0;

  // Score based on field presence and basic validation
  const fieldsToCheck = recordType === 'account' 
    ? ['company_name', 'industry', 'employee_count', 'revenue_range', 'country', 'domain', 'linkedin_url']
    : ['first_name', 'last_name', 'email', 'phone', 'title', 'company', 'linkedin_url'];

  for (const field of fieldsToCheck) {
    const value = enrichedData[field];
    let score = 0;
    
    if (value && value !== '' && value !== 'Unknown') {
      score = 1; // Present
      
      // Extra point for certain validations
      if (field === 'email' && value.includes('@')) score = 2;
      if (field === 'linkedin_url' && value.includes('linkedin.com')) score = 2;
      if (field === 'employee_count' && typeof value === 'number') score = 2;
      if (field === 'phone' && value.replace(/\D/g, '').length >= 10) score = 2;
    }
    
    fieldScores[`${field.replace(/_/g, '_')}_score`] = score;
    totalScore += score;
  }

  const confidence = totalScore >= 12 ? 'high' : totalScore >= 6 ? 'medium' : 'low';

  return {
    field_scores: fieldScores,
    overall_score: totalScore,
    confidence,
    validation_summary: `Basic validation completed. ${Object.keys(fieldScores).filter(k => fieldScores[k] >= 1).length} fields verified.`,
    anomalies: [],
    validated_data: { ...rawInput, ...enrichedData }
  };
}