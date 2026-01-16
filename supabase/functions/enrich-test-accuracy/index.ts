import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enrichment Accuracy Testing Function
 * 
 * Tests enrichment against known-good test data to measure actual accuracy.
 * Returns accuracy scores by source and field.
 */

interface TestConfig {
  test_type: 'lead' | 'account';
  sources_to_test: string[];
  sample_size?: number;
  org_id: string;
}

interface AccuracyResult {
  source: string;
  total_tested: number;
  phone_accuracy: number;
  employee_count_accuracy: number;
  revenue_accuracy: number;
  industry_accuracy: number;
  naics_accuracy: number;
  overall_accuracy: number;
  avg_duration_ms: number;
  total_cost: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const config: TestConfig = await req.json();
    const { test_type, sources_to_test, sample_size = 50, org_id } = config;

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-test-accuracy] Testing ${sources_to_test.join(', ')} for ${test_type}s`);

    // Fetch test data
    const { data: testData, error: testError } = await supabase
      .from('enrichment_test_data')
      .select('*')
      .eq('org_id', org_id)
      .eq('test_type', test_type)
      .limit(sample_size);

    if (testError || !testData || testData.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No test data found',
        details: testError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-test-accuracy] Found ${testData.length} test records`);

    const testRunId = crypto.randomUUID();
    const results: AccuracyResult[] = [];

    // Test each source
    for (const source of sources_to_test) {
      console.log(`[enrich-test-accuracy] Testing source: ${source}`);
      
      const sourceResults = {
        phone_matches: 0,
        employee_matches: 0,
        revenue_matches: 0,
        industry_matches: 0,
        naics_matches: 0,
        total_duration_ms: 0,
        total_cost: 0,
        tested: 0
      };

      for (const testRecord of testData) {
        const startTime = Date.now();
        let enrichedData: any = null;
        let costUsd = 0;

        try {
          // Call appropriate enrichment based on source and type
          if (test_type === 'lead') {
            const { data, error } = await supabase.functions.invoke('enrich-lead', {
              body: {
                leads: [{
                  email: testRecord.input_email,
                  first_name: testRecord.input_name?.split(' ')[0],
                  last_name: testRecord.input_name?.split(' ').slice(1).join(' '),
                  company: testRecord.input_company,
                  domain: testRecord.input_domain
                }],
                org_id,
                sources: [source],
                save_to_db: false
              }
            });
            if (data?.results?.[0]) {
              enrichedData = data.results[0].enriched_data;
              costUsd = data.stats?.cost_estimate || 0;
            }
          } else {
            // Account enrichment
            const { data, error } = await supabase.functions.invoke('enrich-verified', {
              body: {
                accounts: [{
                  id: crypto.randomUUID(),
                  external_id: 'test-' + testRecord.id,
                  name: testRecord.input_company,
                  domain: testRecord.input_domain
                }],
                org_id,
                save_to_db: false
              }
            });
            if (data?.results?.[0]) {
              enrichedData = data.results[0];
              costUsd = data.stats?.cost_estimate || 0;
            }
          }
        } catch (e) {
          console.error(`[enrich-test-accuracy] Error testing ${source}:`, e);
          continue;
        }

        const duration = Date.now() - startTime;
        sourceResults.total_duration_ms += duration;
        sourceResults.total_cost += costUsd;
        sourceResults.tested++;

        if (!enrichedData) continue;

        // Compare results to expected values
        const phoneMatch = comparePhones(enrichedData.phone || enrichedData.enriched_phone, testRecord.expected_phone);
        const employeeMatch = compareEmployeeCount(enrichedData.employee_count, testRecord.expected_employee_count);
        const revenueMatch = compareRevenue(enrichedData.revenue_range, testRecord.expected_revenue_range);
        const industryMatch = compareStrings(enrichedData.industry, testRecord.expected_industry);
        const naicsMatch = compareStrings(enrichedData.naics_code || enrichedData.naics, testRecord.expected_naics);

        if (phoneMatch) sourceResults.phone_matches++;
        if (employeeMatch) sourceResults.employee_matches++;
        if (revenueMatch) sourceResults.revenue_matches++;
        if (industryMatch) sourceResults.industry_matches++;
        if (naicsMatch) sourceResults.naics_matches++;

        // Store individual result
        await supabase.from('enrichment_accuracy_results').insert({
          org_id,
          test_run_id: testRunId,
          test_data_id: testRecord.id,
          source,
          phone_match: phoneMatch,
          employee_count_match: employeeMatch,
          employee_count_variance: testRecord.expected_employee_count && enrichedData.employee_count 
            ? Math.abs(enrichedData.employee_count - testRecord.expected_employee_count) / testRecord.expected_employee_count
            : null,
          revenue_match: revenueMatch,
          industry_match: industryMatch,
          naics_match: naicsMatch,
          enriched_phone: enrichedData.phone,
          enriched_employee_count: enrichedData.employee_count,
          enriched_revenue_range: enrichedData.revenue_range,
          enriched_industry: enrichedData.industry,
          enriched_naics: enrichedData.naics_code,
          enrichment_duration_ms: duration,
          cost_usd: costUsd
        });
      }

      // Calculate accuracy percentages
      const tested = Math.max(sourceResults.tested, 1);
      results.push({
        source,
        total_tested: sourceResults.tested,
        phone_accuracy: Math.round((sourceResults.phone_matches / tested) * 100),
        employee_count_accuracy: Math.round((sourceResults.employee_matches / tested) * 100),
        revenue_accuracy: Math.round((sourceResults.revenue_matches / tested) * 100),
        industry_accuracy: Math.round((sourceResults.industry_matches / tested) * 100),
        naics_accuracy: Math.round((sourceResults.naics_matches / tested) * 100),
        overall_accuracy: Math.round(
          ((sourceResults.phone_matches + sourceResults.employee_matches + 
            sourceResults.revenue_matches + sourceResults.industry_matches + 
            sourceResults.naics_matches) / (tested * 5)) * 100
        ),
        avg_duration_ms: Math.round(sourceResults.total_duration_ms / tested),
        total_cost: sourceResults.total_cost
      });
    }

    console.log(`[enrich-test-accuracy] Completed. Test run: ${testRunId}`);

    return new Response(JSON.stringify({
      success: true,
      test_run_id: testRunId,
      test_type,
      total_test_records: testData.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-test-accuracy] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper functions for comparison
function comparePhones(enriched: string | null, expected: string | null): boolean {
  if (!expected) return true; // No expected value = skip
  if (!enriched) return false;
  
  // Normalize phone numbers
  const normalize = (p: string) => p.replace(/\D/g, '').slice(-10);
  return normalize(enriched) === normalize(expected);
}

function compareEmployeeCount(enriched: number | null, expected: number | null): boolean {
  if (!expected) return true;
  if (!enriched) return false;
  
  // Accept within 30% variance
  const variance = Math.abs(enriched - expected) / expected;
  return variance <= 0.3;
}

function compareRevenue(enriched: string | null, expected: string | null): boolean {
  if (!expected) return true;
  if (!enriched) return false;
  
  // Simple string match for revenue ranges
  return enriched.toLowerCase() === expected.toLowerCase();
}

function compareStrings(enriched: string | null, expected: string | null): boolean {
  if (!expected) return true;
  if (!enriched) return false;
  
  return enriched.toLowerCase().trim() === expected.toLowerCase().trim();
}
