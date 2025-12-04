import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ICPRequest {
  validated_data: any;
  icp_config_id: string;
  org_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validated_data, icp_config_id, org_id }: ICPRequest = await req.json();
    
    console.log(`[ICPAgent] Evaluating against ICP ${icp_config_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch ICP configuration
    const { data: icpConfig, error: icpError } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('id', icp_config_id)
      .single();

    if (icpError || !icpConfig) {
      console.error('[ICPAgent] Failed to fetch ICP config:', icpError);
      return new Response(JSON.stringify({
        success: false,
        error: 'ICP configuration not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Evaluate against ICP criteria
    const evaluation = evaluateICP(validated_data, icpConfig);

    console.log(`[ICPAgent] Result: ${evaluation.icp_pass ? 'PASS' : 'FAIL'}`);
    if (!evaluation.icp_pass) {
      console.log(`[ICPAgent] Fail reasons:`, evaluation.icp_fail_reasons);
    }

    return new Response(JSON.stringify({
      success: true,
      icp_pass: evaluation.icp_pass,
      icp_fail_reasons: evaluation.icp_fail_reasons,
      icp_score: evaluation.icp_score,
      persona_match: evaluation.persona_match
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ICPAgent] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

interface ICPEvaluation {
  icp_pass: boolean;
  icp_fail_reasons: string[];
  icp_score: number;
  persona_match: boolean;
}

function evaluateICP(data: any, icpConfig: any): ICPEvaluation {
  const failReasons: string[] = [];
  let score = 0;
  const maxScore = 100;

  // 1. Company Size Check (weight: 20)
  if (icpConfig.company_sizes && icpConfig.company_sizes.length > 0) {
    const employeeCount = data.employee_count || data.employeeCount;
    if (employeeCount) {
      const sizeMatch = checkCompanySize(employeeCount, icpConfig.company_sizes);
      if (sizeMatch) {
        score += 20;
      } else {
        failReasons.push(`company_size_mismatch: ${employeeCount} employees not in target range`);
      }
    } else {
      score += 5; // Partial credit for unknown
    }
  } else {
    score += 20; // No requirement = pass
  }

  // 2. Revenue Check (weight: 15)
  if (icpConfig.revenue_ranges && icpConfig.revenue_ranges.length > 0) {
    const revenue = data.revenue_range || data.revenueRange || data.revenue;
    if (revenue) {
      const revenueMatch = icpConfig.revenue_ranges.some((r: string) => 
        revenue.toLowerCase().includes(r.toLowerCase()) || 
        r.toLowerCase().includes(revenue.toLowerCase())
      );
      if (revenueMatch) {
        score += 15;
      } else {
        failReasons.push(`revenue_below_threshold: ${revenue} not in target ranges`);
      }
    } else {
      score += 5; // Partial credit for unknown
    }
  } else {
    score += 15;
  }

  // 3. Industry Check (weight: 20)
  if (icpConfig.industries && icpConfig.industries.length > 0) {
    const industry = data.industry || data.industry_norm || data.industryNorm;
    if (industry) {
      const industryMatch = icpConfig.industries.some((i: string) =>
        industry.toLowerCase().includes(i.toLowerCase()) ||
        i.toLowerCase().includes(industry.toLowerCase())
      );
      if (industryMatch) {
        score += 20;
      } else {
        failReasons.push(`industry_not_matched: ${industry} not in target industries`);
      }
    } else {
      score += 5;
    }
  } else {
    score += 20;
  }

  // 4. Geography Check (weight: 15)
  if (icpConfig.geographies && icpConfig.geographies.length > 0) {
    const country = data.country || data.hq_country || data.location?.country;
    if (country) {
      const geoMatch = icpConfig.geographies.some((g: string) =>
        country.toLowerCase().includes(g.toLowerCase()) ||
        g.toLowerCase().includes(country.toLowerCase())
      );
      if (geoMatch) {
        score += 15;
      } else {
        failReasons.push(`country_not_allowed: ${country} not in target geographies`);
      }
    } else {
      score += 5;
    }
  } else {
    score += 15;
  }

  // 5. Persona/Title Check (weight: 20)
  let personaMatch = false;
  if (icpConfig.persona_job_titles && icpConfig.persona_job_titles.length > 0) {
    const title = data.title || data.current_title || data.jobTitle;
    if (title) {
      personaMatch = icpConfig.persona_job_titles.some((t: string) =>
        title.toLowerCase().includes(t.toLowerCase()) ||
        t.toLowerCase().includes(title.toLowerCase())
      );
      if (personaMatch) {
        score += 20;
      } else {
        failReasons.push(`non_target_title: ${title} not in target personas`);
      }
    } else {
      score += 10; // Partial credit - might be account-level
    }
  } else {
    score += 20;
    personaMatch = true;
  }

  // 6. Seniority Check (weight: 10)
  if (icpConfig.persona_seniority_levels && icpConfig.persona_seniority_levels.length > 0) {
    const title = data.title || data.current_title || '';
    const seniorityMatch = checkSeniority(title, icpConfig.persona_seniority_levels);
    if (seniorityMatch) {
      score += 10;
    } else {
      failReasons.push(`seniority_not_matched: title does not match required seniority`);
    }
  } else {
    score += 10;
  }

  // Check for exclusions
  if (icpConfig.excluded_companies && icpConfig.excluded_companies.length > 0) {
    const company = data.company || data.company_name || data.name;
    if (company) {
      const isExcluded = icpConfig.excluded_companies.some((c: string) =>
        company.toLowerCase().includes(c.toLowerCase())
      );
      if (isExcluded) {
        failReasons.push(`company_excluded: ${company} is in exclusion list`);
        score = Math.max(0, score - 50); // Heavy penalty
      }
    }
  }

  if (icpConfig.excluded_industries && icpConfig.excluded_industries.length > 0) {
    const industry = data.industry || data.industry_norm;
    if (industry) {
      const isExcluded = icpConfig.excluded_industries.some((i: string) =>
        industry.toLowerCase().includes(i.toLowerCase())
      );
      if (isExcluded) {
        failReasons.push(`industry_excluded: ${industry} is in exclusion list`);
        score = Math.max(0, score - 50);
      }
    }
  }

  // Determine pass/fail (threshold: 60%)
  const passThreshold = 60;
  const icpPass = score >= passThreshold && failReasons.length <= 1;

  return {
    icp_pass: icpPass,
    icp_fail_reasons: failReasons,
    icp_score: score,
    persona_match: personaMatch
  };
}

function checkCompanySize(employeeCount: number, targetSizes: number[]): boolean {
  // Target sizes are typically thresholds like [50, 200, 500, 1000]
  // Check if employee count falls within any reasonable range
  const sortedSizes = [...targetSizes].sort((a, b) => a - b);
  
  // Simple check: is employee count near any target?
  for (const target of sortedSizes) {
    const lowerBound = target * 0.5;
    const upperBound = target * 2;
    if (employeeCount >= lowerBound && employeeCount <= upperBound) {
      return true;
    }
  }
  
  // Or check if it's above the minimum target
  const minTarget = sortedSizes[0];
  return employeeCount >= minTarget * 0.5;
}

function checkSeniority(title: string, seniorityLevels: string[]): boolean {
  const titleLower = title.toLowerCase();
  
  const seniorityMap: Record<string, string[]> = {
    'C-Level': ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'chief', 'founder', 'owner', 'president'],
    'VP': ['vp', 'vice president', 'evp', 'svp'],
    'Director': ['director', 'head of', 'managing director'],
    'Manager': ['manager', 'lead', 'supervisor', 'team lead'],
    'Senior': ['senior', 'sr.', 'principal', 'staff'],
    'Individual': ['associate', 'analyst', 'specialist', 'coordinator']
  };

  for (const level of seniorityLevels) {
    const keywords = seniorityMap[level] || [];
    if (keywords.some(k => titleLower.includes(k))) {
      return true;
    }
  }
  
  return false;
}