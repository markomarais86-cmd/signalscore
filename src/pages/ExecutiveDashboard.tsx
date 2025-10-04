import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, Target, Database, Download, MapPin, Sparkles, Building2 } from "lucide-react";
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
    completenessScore: 0,
    campaignReadyAccounts: 0,
    coverage: 0,
    totalLeads: 0,
    linkedLeads: 0,
    unlinkedLeads: 0
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

      // Calculate campaign-ready contacts (accounts with contacts + high fit score)
      const accountsWithContacts = new Set(contacts?.map(c => c.account_external_id) || []);
      const highFitAccountIds = new Set(scores?.filter(s => s.overall >= 70).map(s => s.account_external_id) || []);
      const campaignReadyAccounts = [...accountsWithContacts].filter(id => highFitAccountIds.has(id)).length;

      // Calculate data completeness
      const completenessScore = accounts && accounts.length > 0
        ? Math.round(
            (accounts.filter(a => a.industry_norm).length / accounts.length * 25) +
            (accounts.filter(a => a.employee_count).length / accounts.length * 25) +
            (accounts.filter(a => a.revenue_range).length / accounts.length * 25) +
            (accounts.filter(a => a.country).length / accounts.length * 25)
          )
        : 0;

      const finalMetrics = {
        totalAccounts,
        totalScored,
        highFitAccounts,
        averageScore,
        icpMatchQuality,
        completenessScore,
        coverage: totalAccounts > 0 ? Math.round((crmAccounts / totalAccounts) * 100) : 0,
        crmAccounts,
        greenspaceAccounts,
        bothSourcesAccounts,
        campaignReadyAccounts,
        totalLeads,
        linkedLeads,
        unlinkedLeads
      };
      
      console.log('✅ Final metrics calculated:', finalMetrics);
      
      setMetrics(finalMetrics);

      // Generate AI insights if we have scores
      if (totalScored > 0) {
        generateInsights();
      }

      // Fit distribution
      const highFit = scores?.filter(s => s.overall >= 70).length || 0;
      const medFit = scores?.filter(s => s.overall >= 40 && s.overall < 70).length || 0;
      const lowFit = scores?.filter(s => s.overall < 40).length || 0;

      setFitDistribution([
        { name: 'High Fit', value: highFit, color: 'hsl(var(--executive-green))' },
        { name: 'Medium Fit', value: medFit, color: 'hsl(var(--executive-amber))' },
        { name: 'Low Fit', value: lowFit, color: 'hsl(var(--executive-red))' },
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

      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <HeroMetric
          label="Total Accounts"
          value={metrics.totalAccounts.toLocaleString()}
          subtitle="In database"
          icon={Database}
        />

        <HeroMetric
          label="Total Leads"
          value={metrics.totalLeads.toLocaleString()}
          subtitle={`${metrics.linkedLeads} linked to accounts`}
          icon={TrendingUp}
        />
        
        <HeroMetric
          label="CRM Coverage"
          value={metrics.crmAccounts.toLocaleString()}
          subtitle={`${metrics.coverage}% of total`}
          icon={Building2}
        />

        <HeroMetric
          label="Greenspace"
          value={metrics.greenspaceAccounts.toLocaleString()}
          subtitle="Not yet in CRM"
          icon={Sparkles}
          status="success"
        />

        <HeroMetric
          label="High-Fit Matches"
          value={metrics.highFitAccounts.toLocaleString()}
          subtitle={`${metrics.icpMatchQuality}% ICP quality`}
          icon={Target}
        />
      </div>

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
                <p className="text-sm text-muted-foreground mt-1">
                  Accounts ready for outreach campaigns
                </p>
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
