import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function categorizeEmployeeCount(count: number | null): string {
  if (!count) return "Unknown";
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 1000) return "201-1000";
  if (count <= 5000) return "1001-5000";
  return "5000+";
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

const DEFAULT_ACV = 75_000;
const DEFAULT_CONVERSION_RATE = 0.15;

const REVENUE_MIDPOINTS: Record<string, number> = {
  "<$1M": 500_000, "$1M-$5M": 3_000_000, "$5M-$10M": 7_500_000,
  "$10M-$25M": 17_500_000, "$25M-$50M": 37_500_000, "$50M-$100M": 75_000_000,
  "$100M-$250M": 175_000_000, "$250M-$500M": 375_000_000,
  "$500M-$1B": 750_000_000, "$1B-$10B": 5_000_000_000, "$10B+": 15_000_000_000,
};

function revenueRangeToMidpoint(range: string | null): number | null {
  if (!range) return null;
  return REVENUE_MIDPOINTS[range.trim()] ?? null;
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

async function fetchAllReportData(supabase: any, orgId: string) {
  // Parallel data fetches — added brand config + full ICP fields
  const [
    metricsRes,
    icpRes,
    topScoresRes,
    orgRes,
    leadsRes,
    accountsWithIndustry,
    accountsForSize,
    accountsForCompleteness,
    accountsForGeo,
    accountsForLowData,
    scoresRes,
    signalsRes,
    brandConfigRes,
  ] = await Promise.all([
    supabase.rpc("get_dashboard_metrics_cached", { p_org_id: orgId }),
    supabase.from("icp_profiles").select("*").eq("org_id", orgId).eq("status", "active"),
    supabase.from("scores").select("account_external_id, overall, fit, intent, org_id")
      .eq("org_id", orgId).order("overall", { ascending: false }).limit(10),
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    supabase.from("Leads").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("accounts").select("external_id, industry_norm, revenue_range")
      .eq("org_id", orgId).not("industry_norm", "is", null),
    supabase.from("accounts").select("employee_count").eq("org_id", orgId),
    supabase.from("accounts").select("name, industry_norm, employee_count, country, domain, revenue_range")
      .eq("org_id", orgId).limit(500),
    supabase.from("accounts").select("external_id, country")
      .eq("org_id", orgId).not("country", "is", null),
    supabase.from("accounts").select("industry_norm, employee_count, country, revenue_range")
      .eq("org_id", orgId).limit(5000),
    supabase.from("scores").select("account_external_id, overall, fit")
      .eq("org_id", orgId),
    supabase.from("account_signals").select("signal_priority, signal_type")
      .eq("org_id", orgId).is("dismissed_at", null).is("actioned_at", null),
    supabase.from("org_onboarding_config").select("company_name, logo_url, brand_primary_color, brand_secondary_color, value_proposition")
      .eq("org_id", orgId).maybeSingle(),
  ]);

  // Parse metrics
  const raw = Array.isArray(metricsRes.data) ? metricsRes.data?.[0] : metricsRes.data;

  // Data completeness
  const completenessAccounts = accountsForCompleteness.data || [];
  const fields = ["name", "industry_norm", "employee_count", "country", "domain", "revenue_range"];
  let filled = 0, total = 0;
  completenessAccounts.forEach((row: any) => {
    fields.forEach((f) => { total++; if (row[f] != null && row[f] !== "") filled++; });
  });
  const dataCompleteness = total > 0 ? Math.round((filled / total) * 100) : 0;

  const metrics = {
    totalAccounts: raw?.total_accounts || 0,
    scoredAccounts: raw?.scored_accounts || 0,
    highFitAccounts: raw?.high_fit_accounts || 0,
    mediumFitAccounts: raw?.medium_fit_accounts || 0,
    lowFitAccounts: raw?.low_fit_accounts || 0,
    campaignReadyAccounts: raw?.campaign_ready_accounts || 0,
    dataCompleteness,
  };

  // Score map for industry/geo scoring
  const scoreMap = new Map<string, { overall: number; fit: number }>();
  (scoresRes.data || []).forEach((s: any) => {
    scoreMap.set(s.account_external_id, { overall: s.overall || 0, fit: s.fit || 0 });
  });

  // Industry breakdown
  const industries = new Map<string, { accounts: number; highFit: number; totalScore: number; scoredCount: number }>();
  (accountsWithIndustry.data || []).forEach((a: any) => {
    const ind = a.industry_norm || "Unknown";
    const entry = industries.get(ind) || { accounts: 0, highFit: 0, totalScore: 0, scoredCount: 0 };
    entry.accounts++;
    const score = scoreMap.get(a.external_id);
    if (score) { entry.scoredCount++; entry.totalScore += score.overall; if (score.fit >= 70) entry.highFit++; }
    industries.set(ind, entry);
  });
  const totalIndustryAccounts = (accountsWithIndustry.data || []).length;
  const industryBreakdown = Array.from(industries.entries())
    .map(([name, d]) => ({
      name, accounts: d.accounts,
      percentage: totalIndustryAccounts > 0 ? (d.accounts / totalIndustryAccounts) * 100 : 0,
      highFitCount: d.highFit,
      highFitPct: d.accounts > 0 ? (d.highFit / d.accounts) * 100 : 0,
      avgScore: d.scoredCount > 0 ? Math.round(d.totalScore / d.scoredCount) : 0,
    }))
    .sort((a, b) => b.highFitCount - a.highFitCount).slice(0, 12);

  // Size breakdown
  const sizeBuckets: Record<string, number> = { "1-10": 0, "11-50": 0, "51-200": 0, "201-1000": 0, "1001-5000": 0, "5000+": 0, Unknown: 0 };
  const sizeAccounts = accountsForSize.data || [];
  sizeAccounts.forEach((a: any) => { const b = categorizeEmployeeCount(a.employee_count); sizeBuckets[b] = (sizeBuckets[b] || 0) + 1; });
  const totalSizeAccounts = sizeAccounts.length;
  const sizeBreakdown = Object.entries(sizeBuckets)
    .filter(([, c]) => c > 0)
    .map(([name, accounts]) => ({ name, accounts, percentage: totalSizeAccounts > 0 ? (accounts / totalSizeAccounts) * 100 : 0 }))
    .sort((a, b) => b.accounts - a.accounts);

  // Geo breakdown
  const geoData = new Map<string, { count: number; totalScore: number; scoredCount: number }>();
  (accountsForGeo.data || []).forEach((a: any) => {
    const country = a.country || "Unknown";
    const entry = geoData.get(country) || { count: 0, totalScore: 0, scoredCount: 0 };
    entry.count++;
    const score = scoreMap.get(a.external_id);
    if (score !== undefined) { entry.scoredCount++; entry.totalScore += score.overall; }
    geoData.set(country, entry);
  });
  const totalGeoAccounts = (accountsForGeo.data || []).length;
  const geographyDistribution = Array.from(geoData.entries())
    .map(([country, d]) => ({
      country, accounts: d.count,
      percentage: totalGeoAccounts > 0 ? (d.count / totalGeoAccounts) * 100 : 0,
      avgScore: d.scoredCount > 0 ? Math.round(d.totalScore / d.scoredCount) : 0,
    }))
    .sort((a, b) => b.accounts - a.accounts);

  // Low data count
  const lowDataCount = (accountsForLowData.data || []).filter((a: any) => {
    const f = [a.industry_norm, a.employee_count, a.country, a.revenue_range].filter(Boolean).length;
    return f < 2;
  }).length;

  // ICP profiles — now with ALL fields for the ICP detail page
  const icpProfiles = (icpRes.data || []).map((p: any) => ({
    name: p.name || "Unnamed",
    description: p.description || "",
    targetIndustries: p.target_industries || [],
    companySizes: p.company_sizes || [],
    geographies: p.target_geographies || [],
    matchCount: p.match_count || 0,
    tamEstimate: p.tam_estimate || 0,
    confidence: p.confidence_score || 0,
    painPoints: p.pain_points || [],
    buyingSignals: p.buying_signals || [],
    personaJobTitles: p.persona_job_titles || [],
    personaSeniorityLevels: p.persona_seniority_levels || [],
    personaDepartments: p.persona_departments || [],
    techStack: p.tech_stack || [],
  }));

  // Revenue modeling
  const unscoredAccounts = Math.max(metrics.totalAccounts - metrics.scoredAccounts, 0);
  const tamRevenue = metrics.totalAccounts * DEFAULT_ACV;
  const samRevenue = (metrics.highFitAccounts + metrics.mediumFitAccounts) * DEFAULT_ACV;
  const somRevenue = metrics.campaignReadyAccounts * DEFAULT_ACV * DEFAULT_CONVERSION_RATE;
  const leakageRevenue = (unscoredAccounts + lowDataCount) * DEFAULT_ACV * DEFAULT_CONVERSION_RATE;

  // Top 10 prospects
  const topScores = topScoresRes.data || [];
  let topProspects: any[] = [];
  if (topScores.length > 0) {
    const extIds = topScores.map((s: any) => s.account_external_id);
    const [{ data: accountDetails }, { data: leadCounts }] = await Promise.all([
      supabase.from("accounts")
        .select("external_id, name, industry_norm, employee_count, country, revenue_range")
        .eq("org_id", orgId).in("external_id", extIds),
      supabase.from("Leads").select("account_external_id")
        .eq("org_id", orgId).in("account_external_id", extIds),
    ]);
    const accountMap = new Map((accountDetails || []).map((a: any) => [a.external_id, a]));
    const leadCountMap = new Map<string, number>();
    (leadCounts || []).forEach((l: any) => {
      leadCountMap.set(l.account_external_id, (leadCountMap.get(l.account_external_id) || 0) + 1);
    });
    topProspects = topScores.map((s: any) => {
      const acct = accountMap.get(s.account_external_id) as any;
      const midpoint = revenueRangeToMidpoint(acct?.revenue_range);
      return {
        name: acct?.name || s.account_external_id,
        industry: acct?.industry_norm || "N/A",
        size: categorizeEmployeeCount(acct?.employee_count),
        country: acct?.country || "N/A",
        fitScore: s.fit || 0,
        intentScore: s.intent || 0,
        overallScore: s.overall || 0,
        revenueRange: acct?.revenue_range || "N/A",
        leadCount: leadCountMap.get(s.account_external_id) || 0,
        estimatedValue: midpoint ? Math.round(midpoint * 0.001) : DEFAULT_ACV,
      };
    });
  }

  // Signals summary
  const signals = signalsRes.data || [];
  const signalSummary = {
    critical: signals.filter((s: any) => s.signal_priority === "critical").length,
    high: signals.filter((s: any) => s.signal_priority === "high").length,
    total: signals.length,
  };

  const totalLeads = leadsRes.count || 0;
  const companyName = orgRes.data?.name || "Organization";

  // Brand config from org_onboarding_config
  const brandConfig = brandConfigRes.data ? {
    company_name: brandConfigRes.data.company_name || null,
    logo_url: brandConfigRes.data.logo_url || null,
    brand_primary_color: brandConfigRes.data.brand_primary_color || null,
    brand_secondary_color: brandConfigRes.data.brand_secondary_color || null,
    value_proposition: brandConfigRes.data.value_proposition || null,
  } : null;

  return {
    companyName,
    brandConfig,
    metrics,
    icpProfiles,
    tam: tamRevenue,
    sam: samRevenue,
    som: somRevenue,
    industryBreakdown,
    sizeBreakdown,
    geographyDistribution,
    topProspects,
    signalSummary,
    leadStats: {
      totalLeads,
      leadCoverage: metrics.totalAccounts > 0 ? Math.min(Math.round((totalLeads / metrics.totalAccounts) * 100), 100) : 0,
      leadsPerAccount: metrics.totalAccounts > 0 ? parseFloat((totalLeads / metrics.totalAccounts).toFixed(1)) : 0,
    },
    revenueModeling: {
      acv: DEFAULT_ACV,
      conversionRate: DEFAULT_CONVERSION_RATE,
      pipelinePotential: somRevenue,
      revenueAtRisk: leakageRevenue,
      unscoredAccounts,
      lowDataAccounts: lowDataCount,
    },
  };
}

// ─── AI Narrative Generation ────────────────────────────────────────────────

async function generateAINarratives(data: any, companyName: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, returning empty narratives");
    return null;
  }

  const met = data.metrics;
  const rm = data.revenueModeling;
  const topIndustries = data.industryBreakdown.slice(0, 5)
    .map((i: any) => `${i.name} (${i.accounts} accts, ${i.highFitPct?.toFixed(0)}% hi-fit, avg score ${i.avgScore})`)
    .join("; ");
  const topGeos = data.geographyDistribution.slice(0, 5)
    .map((g: any) => `${g.country} (${g.accounts} accts, ${g.percentage.toFixed(1)}%, avg score ${g.avgScore})`)
    .join("; ");
  const topProspectsSummary = data.topProspects.slice(0, 5)
    .map((p: any) => `${p.name} (score ${p.overallScore}, fit ${p.fitScore}, intent ${p.intentScore}, ${p.leadCount} leads)`)
    .join("; ");

  // Full ICP detail for AI context
  const icpSummary = data.icpProfiles
    .map((p: any) => {
      const parts = [`ICP PROFILE: "${p.name}"`];
      if (p.description) parts.push(`Description: ${p.description}`);
      if (p.targetIndustries?.length) parts.push(`Target Industries: ${p.targetIndustries.join(", ")}`);
      if (p.companySizes?.length) parts.push(`Company Sizes: ${p.companySizes.join(", ")}`);
      if (p.geographies?.length) parts.push(`Geographies: ${p.geographies.join(", ")}`);
      if (p.personaJobTitles?.length) parts.push(`Persona Job Titles: ${p.personaJobTitles.join(", ")}`);
      if (p.personaSeniorityLevels?.length) parts.push(`Seniority Levels: ${p.personaSeniorityLevels.join(", ")}`);
      if (p.personaDepartments?.length) parts.push(`Departments: ${p.personaDepartments.join(", ")}`);
      if (p.techStack?.length) parts.push(`Tech Stack: ${p.techStack.join(", ")}`);
      if (p.buyingSignals?.length) parts.push(`Buying Signals: ${p.buyingSignals.join(", ")}`);
      if (p.painPoints?.length) parts.push(`Pain Points: ${p.painPoints.join(", ")}`);
      parts.push(`Confidence: ${p.confidence}%`);
      return parts.join("\n");
    })
    .join("\n\n");

  const dataContext = `
You are a board-level strategic analyst for ${companyName}.
Analyze this data and produce a comprehensive board report.

DATABASE SNAPSHOT:
- Total Accounts: ${met.totalAccounts.toLocaleString()} | Scored: ${met.scoredAccounts.toLocaleString()} | High-Fit: ${met.highFitAccounts.toLocaleString()} | Medium: ${met.mediumFitAccounts.toLocaleString()} | Low: ${met.lowFitAccounts.toLocaleString()}
- Campaign-Ready: ${met.campaignReadyAccounts.toLocaleString()}
- TAM: ${formatCurrency(data.tam)} | SAM: ${formatCurrency(data.sam)} | SOM: ${formatCurrency(data.som)}
- Revenue at Risk: ${formatCurrency(rm.revenueAtRisk)} (${rm.unscoredAccounts} unscored, ${rm.lowDataAccounts} low-data accounts)
- Data Completeness: ${met.dataCompleteness}%
- Total Leads: ${data.leadStats.totalLeads.toLocaleString()} (${data.leadStats.leadsPerAccount}x per account)
- Active Signals: ${data.signalSummary.critical} critical, ${data.signalSummary.high} high priority, ${data.signalSummary.total} total

TOP INDUSTRIES: ${topIndustries || "No industry data"}
TOP GEOGRAPHIES: ${topGeos || "No geo data"}
TOP PROSPECTS: ${topProspectsSummary || "No scored prospects"}

${icpSummary || "No ICP profiles configured"}
`.trim();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a senior strategic analyst preparing a board-level intelligence brief. Your analysis must be data-driven, actionable, and focused on revenue impact. Use precise numbers from the data provided. Be concise but insightful. Identify patterns, risks, and opportunities that executives need to act on. Pay special attention to ICP profile alignment — analyze whether the defined personas, tech stack, and buying signals align with actual account data.",
        },
        { role: "user", content: dataContext },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_board_report",
            description: "Generate structured board report content with executive narrative, findings, recommendations, risk assessment, and ICP analysis.",
            parameters: {
              type: "object",
              properties: {
                executive_summary: {
                  type: "string",
                  description: "2-3 paragraph executive summary covering market position, pipeline health, and key strategic imperatives. Reference specific numbers.",
                },
                key_findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Finding headline (max 10 words)" },
                      detail: { type: "string", description: "1-2 sentence explanation with data" },
                      impact: { type: "string", description: "Revenue or strategic impact" },
                    },
                    required: ["title", "detail", "impact"],
                    additionalProperties: false,
                  },
                  description: "3-5 prioritized key findings",
                },
                strategic_recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string", description: "Specific action to take" },
                      rationale: { type: "string", description: "Why this matters, with data" },
                      priority: { type: "string", enum: ["critical", "high", "medium"] },
                    },
                    required: ["action", "rationale", "priority"],
                    additionalProperties: false,
                  },
                  description: "3-5 strategic recommendations",
                },
                risk_assessment: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      risk: { type: "string", description: "Risk description" },
                      severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      mitigation: { type: "string", description: "Recommended mitigation" },
                    },
                    required: ["risk", "severity", "mitigation"],
                    additionalProperties: false,
                  },
                  description: "3-5 identified risks",
                },
                industry_insights: {
                  type: "string",
                  description: "1-2 paragraph analysis of industry concentration, opportunities, and risks.",
                },
                geo_insights: {
                  type: "string",
                  description: "1-2 paragraph analysis of geographic distribution, expansion opportunities.",
                },
                tam_narrative: {
                  type: "string",
                  description: "1 paragraph interpreting the TAM/SAM/SOM funnel and conversion efficiency.",
                },
                icp_analysis: {
                  type: "string",
                  description: "2-3 paragraph deep analysis of the ICP profile: strengths and gaps in persona targeting, tech stack alignment with market, buying signal effectiveness, pain point relevance. Include specific recommendations for ICP refinement.",
                },
              },
              required: [
                "executive_summary",
                "key_findings",
                "strategic_recommendations",
                "risk_assessment",
                "industry_insights",
                "geo_insights",
                "tam_narrative",
                "icp_analysis",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_board_report" } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    console.error(`AI gateway error: ${status}`, text);
    if (status === 429 || status === 402) {
      return { error: status === 429 ? "rate_limited" : "payment_required", status };
    }
    return null;
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("No tool call in AI response");
    return null;
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return {
      executiveSummary: parsed.executive_summary || "",
      keyFindings: parsed.key_findings || [],
      strategicRecommendations: parsed.strategic_recommendations || [],
      riskAssessment: parsed.risk_assessment || [],
      industryInsights: parsed.industry_insights || "",
      geoInsights: parsed.geo_insights || "",
      tamNarrative: parsed.tam_narrative || "",
      icpAnalysis: parsed.icp_analysis || "",
    };
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return null;
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all data
    const reportData = await fetchAllReportData(supabase, org_id);

    // Generate AI narratives
    const aiNarratives = await generateAINarratives(reportData, reportData.companyName);

    // Check for rate limit / payment errors
    if (aiNarratives?.error) {
      const msg =
        aiNarratives.error === "rate_limited"
          ? "AI rate limit exceeded. Please try again in a moment."
          : "AI credits exhausted. Please add funds to your workspace.";
      return new Response(JSON.stringify({ error: msg }), {
        status: aiNarratives.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        data: reportData,
        aiNarratives: aiNarratives || null,
        brandConfig: reportData.brandConfig || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-board-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
