import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClosedWonDeal {
  id: string;
  account_external_id: string;
  deal_value: number;
  close_date: string;
  sales_cycle_days: number;
}

interface Account {
  external_id: string;
  industry_norm: string;
  employee_count: number;
  revenue_range: string;
  country: string;
}

interface ICPRecommendation {
  name: string;
  description: string;
  industries: string[];
  company_sizes: number[];
  revenue_ranges: string[];
  geographies: string[];
  confidence_score: number;
  match_count: number;
  avg_deal_value: number;
  avg_sales_cycle: number;
  tam_estimate: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) {
      throw new Error('No organization found');
    }

    // Accept optional target_org_id for admin uploads to child orgs
    let body: any = {};
    try { body = await req.json(); } catch {}
    const orgId = body.target_org_id || profile.org_id;

    // Fetch all closed won deals
    const { data: deals, error: dealsError } = await supabase
      .from('closed_won_deals')
      .select('*')
      .eq('org_id', orgId);

    if (dealsError) throw dealsError;

    if (!deals || deals.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No closed won deals found. Upload closed won data first.',
          recommendations: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch accounts for the deals
    const accountIds = [...new Set(deals.map(d => d.account_external_id))];
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, industry_norm, employee_count, revenue_range, country')
      .eq('org_id', orgId)
      .in('external_id', accountIds);

    if (accountsError) throw accountsError;

    // Create account lookup map
    const accountMap = new Map(accounts?.map(a => [a.external_id, a]) || []);

    // Analyze patterns
    const industryStats = new Map<string, { count: number; totalValue: number; totalCycle: number }>();
    const sizeStats = new Map<number, { count: number; totalValue: number; totalCycle: number }>();
    const revenueStats = new Map<string, { count: number; totalValue: number; totalCycle: number }>();
    const geoStats = new Map<string, { count: number; totalValue: number; totalCycle: number }>();

    let totalDealValue = 0;
    let totalSalesCycle = 0;
    let validDeals = 0;

    deals.forEach(deal => {
      const account = accountMap.get(deal.account_external_id);
      if (!account) return;

      validDeals++;
      totalDealValue += Number(deal.deal_value);
      totalSalesCycle += deal.sales_cycle_days || 0;

      // Industry analysis
      if (account.industry_norm) {
        const stats = industryStats.get(account.industry_norm) || { count: 0, totalValue: 0, totalCycle: 0 };
        stats.count++;
        stats.totalValue += Number(deal.deal_value);
        stats.totalCycle += deal.sales_cycle_days || 0;
        industryStats.set(account.industry_norm, stats);
      }

      // Size analysis
      if (account.employee_count) {
        const sizeKey = account.employee_count >= 1000 ? 1000 : 
                        account.employee_count >= 500 ? 500 :
                        account.employee_count >= 200 ? 200 :
                        account.employee_count >= 50 ? 50 : 10;
        const stats = sizeStats.get(sizeKey) || { count: 0, totalValue: 0, totalCycle: 0 };
        stats.count++;
        stats.totalValue += Number(deal.deal_value);
        stats.totalCycle += deal.sales_cycle_days || 0;
        sizeStats.set(sizeKey, stats);
      }

      // Revenue analysis
      if (account.revenue_range) {
        const stats = revenueStats.get(account.revenue_range) || { count: 0, totalValue: 0, totalCycle: 0 };
        stats.count++;
        stats.totalValue += Number(deal.deal_value);
        stats.totalCycle += deal.sales_cycle_days || 0;
        revenueStats.set(account.revenue_range, stats);
      }

      // Geography analysis
      if (account.country) {
        const stats = geoStats.get(account.country) || { count: 0, totalValue: 0, totalCycle: 0 };
        stats.count++;
        stats.totalValue += Number(deal.deal_value);
        stats.totalCycle += deal.sales_cycle_days || 0;
        geoStats.set(account.country, stats);
      }
    });

    const avgDealValue = validDeals > 0 ? totalDealValue / validDeals : 0;
    const avgSalesCycle = validDeals > 0 ? totalSalesCycle / validDeals : 0;

    // Generate recommendations - top performing segments
    const topIndustries = Array.from(industryStats.entries())
      .filter(([_, stats]) => stats.count >= 2)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, 5)
      .map(([industry]) => industry);

    const topSizes = Array.from(sizeStats.entries())
      .filter(([_, stats]) => stats.count >= 2)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, 3)
      .map(([size]) => size);

    const topRevenues = Array.from(revenueStats.entries())
      .filter(([_, stats]) => stats.count >= 2)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, 3)
      .map(([revenue]) => revenue);

    const topGeos = Array.from(geoStats.entries())
      .filter(([_, stats]) => stats.count >= 2)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, 5)
      .map(([geo]) => geo);

    // Calculate confidence based on data volume and consistency
    const dataVolume = Math.min(validDeals / 10, 1); // Max at 10 deals
    const industryConcentration = topIndustries.length > 0 ? 
      (industryStats.get(topIndustries[0])?.count || 0) / validDeals : 0;
    const confidenceScore = Math.round((dataVolume * 50 + industryConcentration * 50));

    // Calculate TAM estimate (avg deal value * total addressable accounts)
    // Using a conservative multiplier based on win rate
    const winRate = 0.2; // Assume 20% win rate for TAM calculation
    const addressableMultiplier = 100; // Estimate 100x addressable market
    const tamEstimate = Math.round(avgDealValue * addressableMultiplier / winRate);

    const recommendation: ICPRecommendation = {
      name: `Win-Based ICP (${validDeals} Deals)`,
      description: `Generated from ${validDeals} closed won deals with $${(totalDealValue / 1000000).toFixed(1)}M total value`,
      industries: topIndustries,
      company_sizes: topSizes,
      revenue_ranges: topRevenues,
      geographies: topGeos,
      confidence_score: confidenceScore,
      match_count: validDeals,
      avg_deal_value: Math.round(avgDealValue),
      avg_sales_cycle: Math.round(avgSalesCycle),
      tam_estimate: tamEstimate
    };

    // Log analysis
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      action: 'closed_won_analysis',
      actor: user.email,
      meta: {
        deals_analyzed: validDeals,
        total_value: totalDealValue,
        avg_deal_value: avgDealValue,
        confidence_score: confidenceScore
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          total_deals: deals.length,
          valid_deals: validDeals,
          total_value: totalDealValue,
          avg_deal_value: avgDealValue,
          avg_sales_cycle: avgSalesCycle,
          confidence_score: confidenceScore
        },
        recommendations: [recommendation],
        patterns: {
          industries: Array.from(industryStats.entries()).map(([name, stats]) => ({
            name,
            count: stats.count,
            avg_value: stats.totalValue / stats.count,
            avg_cycle: stats.totalCycle / stats.count
          })),
          sizes: Array.from(sizeStats.entries()).map(([size, stats]) => ({
            size,
            count: stats.count,
            avg_value: stats.totalValue / stats.count,
            avg_cycle: stats.totalCycle / stats.count
          })),
          geographies: Array.from(geoStats.entries()).map(([name, stats]) => ({
            name,
            count: stats.count,
            avg_value: stats.totalValue / stats.count,
            avg_cycle: stats.totalCycle / stats.count
          }))
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing closed won deals:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
