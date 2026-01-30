import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Activity, Target, BarChart3, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCost } from "@/utils/enrichment-cost-calculator";

interface SpendingData {
  phase: string;
  spent: number;
  calls: number;
}

interface EnrichmentStats {
  totalEnriched: number;
  successRate: number;
  avgConfidence: number;
  completenessGain: number;
  conversionRate: number;
  avgDealValue: number;
}

export function EnrichmentAnalyticsDashboard() {
  const { userProfile } = useAuth();
  const [spending, setSpending] = useState<SpendingData[]>([]);
  const [stats, setStats] = useState<EnrichmentStats>({
    totalEnriched: 0,
    successRate: 0,
    avgConfidence: 0,
    completenessGain: 0,
    conversionRate: 0,
    avgDealValue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadAnalytics();
    }
  }, [userProfile]);

  const loadAnalytics = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      await Promise.all([
        loadSpendingData(),
        loadEnrichmentStats()
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpendingData = async () => {
    if (!userProfile?.org_id) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase
      .from('enrichment_spending')
      .select('phase, total_spent, total_calls')
      .eq('org_id', userProfile.org_id)
      .eq('month_start', monthStart.toISOString().split('T')[0]);

    if (!error && data) {
      setSpending(data.map(d => ({
        phase: d.phase,
        spent: Number(d.total_spent),
        calls: d.total_calls
      })));
    }
  };

  const loadEnrichmentStats = async () => {
    if (!userProfile?.org_id) return;

    // Get enrichment history stats
    const { data: historyData } = await supabase
      .from('enrichment_history')
      .select('status, enrichment_type')
      .eq('org_id', userProfile.org_id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Get account stats for enriched accounts
    const { data: accountData } = await supabase
      .from('accounts')
      .select('external_id, enriched_from, enrichment_confidence, employee_count, revenue_range, industry_norm')
      .eq('org_id', userProfile.org_id)
      .not('enriched_from', 'is', null);

    // Get all accounts to calculate completeness gain
    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('external_id, employee_count, revenue_range, industry_norm, enriched_from')
      .eq('org_id', userProfile.org_id);

    // Get leads for conversion rate calculation
    const { data: leadsData } = await supabase
      .from('Leads')
      .select('id, status, account_external_id')
      .eq('org_id', userProfile.org_id);

    // Get deals for average deal value
    const { data: dealsData } = await supabase
      .from('deals')
      .select('amount, account_external_id, stage')
      .eq('org_id', userProfile.org_id)
      .eq('stage', 'closed_won');

    // Calculate real metrics
    const totalEnriched = accountData?.length || 0;
    const successRate = historyData && historyData.length > 0 ? 
      (historyData.filter(h => h.status === 'success').length / historyData.length) * 100 : 0;
    
    const confidenceScores = (accountData || [])
      .filter(a => a.enrichment_confidence)
      .map(a => a.enrichment_confidence);
    const avgConfidence = confidenceScores.length > 0 ?
      confidenceScores.reduce((sum, c) => sum + (c as number), 0) / confidenceScores.length : 0;

    // Calculate completeness gain: compare enriched vs non-enriched accounts
    const calculateCompleteness = (accounts: any[]) => {
      if (!accounts || accounts.length === 0) return 0;
      let filledFields = 0;
      const totalFields = accounts.length * 3; // 3 key fields: employee_count, revenue_range, industry_norm
      accounts.forEach(a => {
        if (a.employee_count) filledFields++;
        if (a.revenue_range) filledFields++;
        if (a.industry_norm) filledFields++;
      });
      return (filledFields / totalFields) * 100;
    };

    const enrichedAccounts = (allAccounts || []).filter(a => a.enriched_from);
    const nonEnrichedAccounts = (allAccounts || []).filter(a => !a.enriched_from);
    const enrichedCompleteness = calculateCompleteness(enrichedAccounts);
    const nonEnrichedCompleteness = calculateCompleteness(nonEnrichedAccounts);
    const completenessGain = enrichedCompleteness - nonEnrichedCompleteness;

    // Calculate conversion rate: leads with enriched accounts that converted
    const enrichedAccountIds = new Set((accountData || []).map(a => a.external_id));
    const enrichedLeads = (leadsData || []).filter(l => l.account_external_id && enrichedAccountIds.has(l.account_external_id));
    const wonLeads = enrichedLeads.filter(l => l.status === 'won' || l.status === 'converted');
    const conversionRate = enrichedLeads.length > 0 ? (wonLeads.length / enrichedLeads.length) * 100 : 0;

    // Calculate average deal value for enriched accounts
    const enrichedDeals = (dealsData || []).filter(d => d.account_external_id && enrichedAccountIds.has(d.account_external_id));
    const avgDealValue = enrichedDeals.length > 0 
      ? enrichedDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) / enrichedDeals.length 
      : 0;

    setStats({
      totalEnriched,
      successRate,
      avgConfidence: avgConfidence * 100,
      completenessGain: Math.max(0, completenessGain),
      conversionRate,
      avgDealValue
    });
  };

  const totalSpent = spending.reduce((sum, s) => sum + s.spent, 0);
  const totalCalls = spending.reduce((sum, s) => sum + s.calls, 0);

  const phaseColors = {
    pdl: 'bg-blue-500',
    clearbit: 'bg-green-500',
    ai: 'bg-purple-500',
    deep_research: 'bg-[hsl(var(--primary))]'
  };

  const phaseLabels = {
    pdl: 'PDL',
    clearbit: 'Clearbit',
    ai: 'AI Estimation',
    deep_research: 'Deep Research'
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading analytics...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Tracking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Cost Tracking</CardTitle>
          </div>
          <CardDescription>Enrichment spending for current month</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{formatCost(totalSpent)}</div>
              <div className="text-sm text-muted-foreground">Total Spent</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{totalCalls.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Calls</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {totalCalls > 0 ? formatCost(totalSpent / totalCalls) : '$0'}
              </div>
              <div className="text-sm text-muted-foreground">Avg Cost/Call</div>
            </div>
          </div>

          {/* Phase Breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Cost by Phase</h4>
            {spending.map((item) => {
              const percentage = totalSpent > 0 ? (item.spent / totalSpent) * 100 : 0;
              return (
                <div key={item.phase} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{phaseLabels[item.phase as keyof typeof phaseLabels]}</span>
                    <span className="font-medium">{formatCost(item.spent)} ({item.calls} calls)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${phaseColors[item.phase as keyof typeof phaseColors]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Volume & Coverage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Volume & Coverage</CardTitle>
          </div>
          <CardDescription>Enrichment activity over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-2xl font-bold mb-1">{stats.totalEnriched.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Accounts Enriched</div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">{stats.successRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Quality Metrics</CardTitle>
          </div>
          <CardDescription>Data quality improvements from enrichment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Average Confidence Score</span>
              <Badge className="bg-[hsl(var(--signal-high))]">{stats.avgConfidence.toFixed(1)}%</Badge>
            </div>
            <Progress value={stats.avgConfidence} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Data Completeness Gain</span>
              <Badge variant="outline">+{stats.completenessGain}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Average improvement in field population after enrichment
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ROI & Impact */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>ROI & Impact</CardTitle>
          </div>
          <CardDescription>Business impact of enriched data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-2xl font-bold mb-1">{stats.conversionRate}%</div>
              <div className="text-sm text-muted-foreground">Enriched → Opportunity</div>
              <p className="text-xs text-muted-foreground mt-1">
                Conversion rate for enriched accounts
              </p>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">${(stats.avgDealValue / 1000).toFixed(0)}k</div>
              <div className="text-sm text-muted-foreground">Avg Deal Value</div>
              <p className="text-xs text-muted-foreground mt-1">
                For enriched vs non-enriched accounts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
