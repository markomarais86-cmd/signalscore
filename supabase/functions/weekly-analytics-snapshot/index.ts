import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnapshotData {
  org_id: string;
  snapshot_date: string;
  total_accounts: number;
  high_fit_accounts: number;
  medium_fit_accounts: number;
  low_fit_accounts: number;
  high_fit_percentage: number;
  medium_fit_percentage: number;
  low_fit_percentage: number;
  data_completeness: number;
  tam_accounts: number;
  sam_accounts: number;
  som_accounts: number;
  top_countries: any[];
  geography_distribution: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting weekly analytics snapshot generation...');

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      throw orgsError;
    }

    const snapshotDate = new Date().toISOString().split('T')[0];
    const snapshots: SnapshotData[] = [];

    for (const org of orgs || []) {
      console.log(`Processing snapshot for org: ${org.id}`);

      // Get total accounts and scores
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, country')
        .eq('org_id', org.id);

      if (accountsError) {
        console.error(`Error fetching accounts for org ${org.id}:`, accountsError);
        continue;
      }

      const totalAccounts = accounts?.length || 0;

      // Get score distribution
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('overall_fit')
        .eq('org_id', org.id);

      if (scoresError) {
        console.error(`Error fetching scores for org ${org.id}:`, scoresError);
        continue;
      }

      const highFit = scores?.filter(s => s.overall_fit === 'High Fit').length || 0;
      const mediumFit = scores?.filter(s => s.overall_fit === 'Medium Fit').length || 0;
      const lowFit = scores?.filter(s => s.overall_fit === 'Low Fit').length || 0;

      const highFitPct = totalAccounts > 0 ? (highFit / totalAccounts) * 100 : 0;
      const mediumFitPct = totalAccounts > 0 ? (mediumFit / totalAccounts) * 100 : 0;
      const lowFitPct = totalAccounts > 0 ? (lowFit / totalAccounts) * 100 : 0;

      // Calculate data completeness
      const { data: completeness } = await supabase
        .rpc('calculate_data_quality', { p_org_id: org.id })
        .single();

      // Get geography distribution
      const countryCounts = (accounts || []).reduce((acc: any, a: any) => {
        if (a.country) {
          acc[a.country] = (acc[a.country] || 0) + 1;
        }
        return acc;
      }, {});

      const topCountries = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      // Get TAM from external data sources
      const { data: tamData } = await supabase
        .from('external_data_sources')
        .select('total_accounts')
        .eq('org_id', org.id)
        .eq('is_active', true)
        .maybeSingle();

      snapshots.push({
        org_id: org.id,
        snapshot_date: snapshotDate,
        total_accounts: totalAccounts,
        high_fit_accounts: highFit,
        medium_fit_accounts: mediumFit,
        low_fit_accounts: lowFit,
        high_fit_percentage: highFitPct,
        medium_fit_percentage: mediumFitPct,
        low_fit_percentage: lowFitPct,
        data_completeness: completeness?.overall_completeness || 0,
        tam_accounts: Number(tamData?.total_accounts || 0),
        sam_accounts: totalAccounts, // SAM = total scored accounts
        som_accounts: highFit, // SOM = high fit accounts (serviceable obtainable market)
        top_countries: topCountries,
        geography_distribution: countryCounts,
      });
    }

    // Insert snapshots (upsert to handle duplicates)
    if (snapshots.length > 0) {
      const { error: insertError } = await supabase
        .from('weekly_analytics_snapshots')
        .upsert(snapshots, { onConflict: 'org_id,snapshot_date' });

      if (insertError) {
        console.error('Error inserting snapshots:', insertError);
        throw insertError;
      }

      console.log(`Successfully created ${snapshots.length} weekly snapshots`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshotsCreated: snapshots.length,
        date: snapshotDate,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in weekly-analytics-snapshot:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
