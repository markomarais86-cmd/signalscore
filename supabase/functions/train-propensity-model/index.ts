import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropensityFeatures {
  fit_score: number;
  intent_score: number;
  reachability_score: number;
  has_contacts: boolean;
  industry_match: boolean;
  size_match: boolean;
  geo_match: boolean;
  engagement_level: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) throw new Error('Organization not found');

    console.log(`Training propensity model for org ${profile.org_id}`);

    // Get accounts with scores
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('accounts')
      .select(`
        external_id,
        name,
        industry_norm,
        employee_count,
        country,
        scores (overall, fit, intent, reachability)
      `)
      .eq('org_id', profile.org_id);

    if (accountsError) throw accountsError;

    // Get closed won deals for training labels
    const { data: deals } = await supabaseClient
      .from('closed_won_deals')
      .select('account_external_id, deal_amount')
      .eq('org_id', profile.org_id);

    // Get contact counts per account
    const { data: contactCounts } = await supabaseClient
      .from('contacts')
      .select('account_external_id')
      .eq('org_id', profile.org_id);

    const contactMap = new Map<string, number>();
    contactCounts?.forEach(c => {
      contactMap.set(c.account_external_id, (contactMap.get(c.account_external_id) || 0) + 1);
    });

    // Get active ICP for matching
    const { data: icp } = await supabaseClient
      .from('icp_profiles')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('status', 'active')
      .single();

    // Build training dataset
    const dealAccountIds = new Set(deals?.map(d => d.account_external_id) || []);
    const trainingData = accounts?.map(account => {
      const score = account.scores?.[0];
      const hasContacts = (contactMap.get(account.external_id) || 0) > 0;
      const wonDeal = dealAccountIds.has(account.external_id);

      // Feature engineering
      const features: PropensityFeatures = {
        fit_score: score?.fit || 0,
        intent_score: score?.intent || 0,
        reachability_score: score?.reachability || 0,
        has_contacts: hasContacts,
        industry_match: icp?.industries?.includes(account.industry_norm) || false,
        size_match: icp?.company_sizes?.includes(account.employee_count) || false,
        geo_match: icp?.geographies?.includes(account.country) || false,
        engagement_level: score?.overall || 0,
      };

      return {
        account_id: account.external_id,
        features,
        label: wonDeal,
      };
    }) || [];

    // Simple propensity scoring algorithm (weighted features)
    const weights = {
      fit_score: 0.35,
      intent_score: 0.25,
      reachability_score: 0.15,
      has_contacts: 0.10,
      industry_match: 0.05,
      size_match: 0.05,
      geo_match: 0.05,
    };

    // Calculate propensity scores
    const scoredAccounts = trainingData.map(data => {
      let propensityScore = 0;
      
      propensityScore += (data.features.fit_score / 100) * weights.fit_score * 100;
      propensityScore += (data.features.intent_score / 100) * weights.intent_score * 100;
      propensityScore += (data.features.reachability_score / 100) * weights.reachability_score * 100;
      propensityScore += (data.features.has_contacts ? 1 : 0) * weights.has_contacts * 100;
      propensityScore += (data.features.industry_match ? 1 : 0) * weights.industry_match * 100;
      propensityScore += (data.features.size_match ? 1 : 0) * weights.size_match * 100;
      propensityScore += (data.features.geo_match ? 1 : 0) * weights.geo_match * 100;

      // Boost score if account has historical win
      if (data.label) {
        propensityScore = Math.min(100, propensityScore * 1.2);
      }

      return {
        account_external_id: data.account_id,
        propensity_score: Math.round(propensityScore),
        computed_at: new Date().toISOString(),
      };
    });

    // Update accounts with propensity scores
    const updatePromises = scoredAccounts.map(scored => 
      supabaseClient
        .from('accounts')
        .update({
          propensity_score: scored.propensity_score,
          propensity_computed_at: scored.computed_at,
        })
        .eq('org_id', profile.org_id)
        .eq('external_id', scored.account_external_id)
    );

    await Promise.all(updatePromises);

    // Calculate model metrics
    const avgPropensity = scoredAccounts.reduce((sum, s) => sum + s.propensity_score, 0) / scoredAccounts.length;
    const highPropensity = scoredAccounts.filter(s => s.propensity_score >= 70).length;

    console.log(`Updated ${scoredAccounts.length} accounts with propensity scores`);

    return new Response(
      JSON.stringify({
        success: true,
        model: {
          accounts_scored: scoredAccounts.length,
          avg_propensity: Math.round(avgPropensity),
          high_propensity_count: highPropensity,
          training_samples: trainingData.length,
          positive_labels: trainingData.filter(d => d.label).length,
          weights,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error training propensity model:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
