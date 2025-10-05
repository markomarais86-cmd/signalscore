import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, Target, Database, Download, MapPin, Sparkles, Building2, Settings, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { useICPInsights } from "@/hooks/use-icp-insights";
import { Lightbulb } from "lucide-react";

export default function ExecutiveDashboard() {
  const { userProfile } = useAuth();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const { insights, statistics, loading: insightsLoading, generateInsights } = useICPInsights();
  
  const [metrics, setMetrics] = useState({
    totalAccounts: 0,
    crmAccounts: 0,
    greenspaceAccounts: 0,
    bothSourcesAccounts: 0,
    totalScored: 0,
    highFitAccounts: 0,
    averageScore: 0,
    icpMatchQuality: 0,
    icpCoverage: 0,
    scoringProgress: 0,
    completenessScore: 0,
    campaignReadyAccounts: 0,
    campaignReadyLeads: 0,
    coverage: 0,
    totalLeads: 0,
    linkedLeads: 0,
    unlinkedLeads: 0,
    crmLeads: 0,
    databaseLeads: 0,
    highFitLeads: 0
  });
  
  const [fitDistribution, setFitDistribution] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadUnifiedData();
    }
  }, [userProfile?.org_id]);

  const loadUnifiedData = async () => {
    if (!userProfile?.org_id) return;
    
    console.log('📊 Loading dashboard data for org:', userProfile.org_id);
    setLoading(true);
    try {
      // Fetch all accounts with data source info
      const { data: accounts, error: accountsError, count: accountsCount } = await supabase
        .from('accounts')
        .select('*, data_source, external_database_match', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(10000);

      console.log('📦 Accounts fetched:', accounts?.length, 'Total count:', accountsCount, 'Error:', accountsError);

      if (accountsError) throw accountsError;

      // Fetch scores
      const { data: scores, error: scoresError, count: scoresCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(10000);

      console.log('📈 Scores fetched:', scores?.length, 'Total count:', scoresCount, 'Error:', scoresError);

      if (scoresError) throw scoresError;

      // Fetch ICP profiles
      const { data: icpProfiles, error: icpError } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('status', 'active');

      if (icpError) throw icpError;

      // Fetch contacts for reachability metrics
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id);

      if (contactsError) throw contactsError;

      // Fetch leads
      const { data: leads, error: leadsError, count: leadsCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(10000);

      console.log('📋 Leads fetched:', leads?.length, 'Total count:', leadsCount, 'Error:', leadsError);

      if (leadsError) throw leadsError;

      // Get accurate counts for data sources
      const { count: crmCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .in('data_source', ['crm', 'both']);

      const { count: greenspaceCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'database')
        .eq('external_database_match', true);

      const { count: bothCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'both');

      const { count: linkedLeadsCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .not('account_external_id', 'is', null);

      // Count leads by account source using database function
      const { data: crmLeadsData } = await supabase
        .rpc('count_leads_by_account_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'crm'
        });

      const { data: databaseLeadsData } = await supabase
        .rpc('count_leads_by_account_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'database'
        });

      const { data: highFitLeadsData } = await supabase
        .rpc('count_high_fit_leads', {
          p_org_id: userProfile.org_id
        });

      const { data: campaignReadyData } = await supabase
        .rpc('count_campaign_ready_accounts', {
          p_org_id: userProfile.org_id
        });

      const { data: campaignReadyLeadsData } = await supabase
        .rpc('count_campaign_ready_leads', {
          p_org_id: userProfile.org_id
        });

      const { data: completenessData } = await supabase
        .rpc('calculate_data_completeness', {
          p_org_id: userProfile.org_id
        });

      const crmLeadsCount = crmLeadsData || 0;
      const databaseLeadsCount = databaseLeadsData || 0;
      const highFitLeadsCount = highFitLeadsData || 0;
      const campaignReadyAccounts = campaignReadyData || 0;
      const campaignReadyLeads = campaignReadyLeadsData || 0;
      const completenessScore = completenessData || 0;

      console.log('📋 CRM leads:', crmLeadsCount, 'Database leads:', databaseLeadsCount, 'High fit leads:', highFitLeadsCount);

      const totalAccounts = accountsCount || 0;
      const totalLeads = leadsCount || 0;
      const linkedLeads = linkedLeadsCount || 0;
      const unlinkedLeads = totalLeads - linkedLeads;
      const crmAccounts = crmCount || 0;
      const greenspaceAccounts = greenspaceCount || 0;
      const bothSourcesAccounts = bothCount || 0;
      
      console.log('🔢 Total accounts:', totalAccounts, 'Total leads:', totalLeads);
      console.log('📋 Linked leads:', linkedLeads, 'Unlinked leads:', unlinkedLeads);
      console.log('📊 CRM accounts:', crmAccounts, 'Greenspace:', greenspaceAccounts, 'Both:', bothSourcesAccounts);
      
      // Calculate ICP metrics
      const totalScored = scoresCount || 0;
      
      const { count: highFitCount, error: highFitError } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70);
      
      console.log('🎯 High fit query result:', { highFitCount, highFitError, totalScored });
      
      const highFitAccounts = highFitCount || 0;
      
      console.log('🎯 Total scored:', totalScored, 'High fit:', highFitAccounts);
      const averageScore = scores && scores.length > 0 
        ? Math.round(scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scores.length)
        : 0;

      const icpMatchQuality = highFitAccounts > 0 
        ? Math.round((highFitAccounts / totalAccounts) * 100)
        : 0;

      // Calculate ICP coverage and scoring progress
      const icpCoverage = totalAccounts > 0 
        ? Math.round((highFitAccounts / totalAccounts) * 100)
        : 0;
      
      const scoringProgress = totalAccounts > 0
        ? Math.round((totalScored / totalAccounts) * 100)
        : 0;

      // Use database-calculated values
      const finalCompletenessScore = completenessScore;
      const finalCampaignReadyAccounts = campaignReadyAccounts;

      const finalMetrics = {
        totalAccounts,
        totalScored,
        highFitAccounts,
        averageScore,
        icpMatchQuality,
        icpCoverage,
        scoringProgress,
        completenessScore: finalCompletenessScore,
        coverage: totalAccounts > 0 ? Math.round((crmAccounts / totalAccounts) * 100) : 0,
        crmAccounts,
        greenspaceAccounts,
        bothSourcesAccounts,
        campaignReadyAccounts: finalCampaignReadyAccounts,
        campaignReadyLeads,
        totalLeads,
        linkedLeads,
        unlinkedLeads,
        crmLeads: crmLeadsCount,
        databaseLeads: databaseLeadsCount,
        highFitLeads: highFitLeadsCount
      };
      
      console.log('✅ Final metrics calculated:', finalMetrics);
      
      setMetrics(finalMetrics);

      // Generate AI insights if we have scores
      if (totalScored > 0) {
        generateInsights();
      }

      // Fit distribution - use database counts
      const { count: highFitDistCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70);

      const { count: medFitDistCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 40)
        .lt('overall', 70);

      const { count: lowFitDistCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .lt('overall', 40);

      setFitDistribution([
        { name: 'High Fit', value: highFitDistCount || 0, color: 'hsl(var(--executive-green))' },
        { name: 'Medium Fit', value: medFitDistCount || 0, color: 'hsl(var(--executive-amber))' },
        { name: 'Low Fit', value: lowFitDistCount || 0, color: 'hsl(var(--executive-red))' },
      ]);

      // Geographic distribution
      const geoCounts = accounts?.reduce((acc, a) => {
        const country = a.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setGeoData(
        Object.entries(geoCounts || {})
          .map(([country, count]) => ({ country, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      completeStep('explore_dashboard');

    } catch (error: any) {
      console.error('Error loading unified data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Overview Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Loading your unified CRM intelligence...</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Overview Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Unified view of your CRM data and available opportunities
          </p>
        </div>
      </div>

      <OnboardingProgress />

      {/* Unlinked Leads Status Indicator */}
      {metrics.unlinkedLeads > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              {metrics.unlinkedLeads.toLocaleString()} leads need processing
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/data-upload')}
            >
              Go to Data Upload
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Metrics - Three Main Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CRM Block */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              CRM Data
            </CardTitle>
            <CardDescription>
              Accounts and leads in your CRM
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Accounts</p>
              <p className="text-3xl font-bold text-primary">{metrics.crmAccounts.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leads</p>
              <p className="text-3xl font-bold">{(metrics.crmLeads || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Database/Greenspace Block */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-success" />
              Greenspace Available
            </CardTitle>
            <CardDescription>
              Not yet in your CRM
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Accounts</p>
              <p className="text-3xl font-bold text-success">{metrics.greenspaceAccounts.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leads</p>
              <p className="text-3xl font-bold">{(metrics.databaseLeads || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* High Fit Block */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              High-Fit ICP Matches
            </CardTitle>
            <CardDescription>
              Score 70+ on ICP criteria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Accounts</p>
              <p className="text-3xl font-bold text-primary">{metrics.highFitAccounts.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leads</p>
              <p className="text-3xl font-bold">{metrics.highFitLeads.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ICP Coverage and Scoring Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              ICP Coverage
            </CardTitle>
            <CardDescription>
              Percentage of CRM data matching your ICP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-5xl font-bold text-primary">{metrics.icpCoverage}%</div>
              <p className="text-sm text-muted-foreground">
                {metrics.highFitAccounts.toLocaleString()} of {metrics.totalAccounts.toLocaleString()} accounts match ICP
              </p>
              <div className="pt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ width: `${metrics.icpCoverage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--signal-medium))]" />
              Scoring Progress
            </CardTitle>
            <CardDescription>
              Accounts scored with ICP criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-5xl font-bold text-[hsl(var(--signal-medium))]">{metrics.scoringProgress}%</div>
              <p className="text-sm text-muted-foreground">
                {metrics.totalScored.toLocaleString()} of {metrics.totalAccounts.toLocaleString()} accounts scored
              </p>
              <div className="pt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[hsl(var(--signal-medium))] transition-all" 
                    style={{ width: `${metrics.scoringProgress}%` }}
                  />
                </div>
              </div>
              {metrics.scoringProgress < 100 && (
                <p className="text-xs text-muted-foreground pt-2">
                  {(metrics.totalAccounts - metrics.totalScored).toLocaleString()} accounts remaining
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unlinked Leads Status */}
      {metrics.unlinkedLeads > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {metrics.unlinkedLeads.toLocaleString()} leads waiting to be matched to accounts (auto-matching enabled in settings)
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/settings?tab=automation')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Campaign Ready + Data Quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Campaign-Ready Contacts
            </CardTitle>
            <CardDescription>
              High-fit accounts with contact data available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-4xl font-bold text-primary">{metrics.campaignReadyAccounts.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Accounts</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[hsl(var(--signal-medium))]">{(metrics.campaignReadyLeads || 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Leads ready for outreach</p>
              </div>
              <Button onClick={() => navigate('/campaign-builder')} className="w-full">
                Build Campaign List
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Completeness</CardTitle>
            <CardDescription>
              Quality of your account data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-4xl font-bold text-primary">{metrics.completenessScore}%</p>
                <p className="text-sm text-muted-foreground mt-1">
                  of accounts have complete firmographic data
                </p>
              </div>
              {metrics.completenessScore < 70 && (
                <Button variant="outline" onClick={() => navigate('/data-upload')} className="w-full">
                  Improve Data Quality
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ICP Fit Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>ICP Fit Distribution</CardTitle>
          <CardDescription>
            Distribution of accounts by ICP match quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fitDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {fitDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Top Geographies
          </CardTitle>
          <CardDescription>
            Account distribution by country
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {geoData.map((geo) => (
              <div key={geo.country} className="flex items-center justify-between">
                <span className="font-medium">{geo.country}</span>
                <Badge variant="secondary">{geo.count.toLocaleString()} accounts</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>
              Based on your current ICP and account data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.slice(0, 3).map((insight, idx) => (
                <div key={idx} className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1">{insight.type}</Badge>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      <p className="text-sm text-primary mt-2 font-medium">
                        Impact: {insight.impact}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Next Steps</CardTitle>
          <CardDescription>
            Actions to improve your go-to-market strategy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.totalScored === 0 && (
              <Button onClick={() => navigate('/icp-manager')} className="w-full justify-start" variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Define Your ICP Profile
              </Button>
            )}
            {metrics.campaignReadyAccounts > 0 && (
              <Button onClick={() => navigate('/campaign-builder')} className="w-full justify-start" variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Build Your First Campaign List
              </Button>
            )}
            {metrics.completenessScore < 70 && (
              <Button onClick={() => navigate('/data-upload')} className="w-full justify-start" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Upload More Account Data
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
