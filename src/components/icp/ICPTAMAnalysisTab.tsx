import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Target, TrendingUp, Building2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { ICPProfile } from '@/types/icp';

interface TAMMetrics {
  tamAccounts: number;
  samAccounts: number;
  somAccounts: number;
  tamValue: number;
  samValue: number;
  somValue: number;
}

interface ICPTAMAnalysisTabProps {
  icp: ICPProfile;
}

const AVG_DEAL_SIZE = 75000;
const CONVERSION_RATE = 0.15;

export function ICPTAMAnalysisTab({ icp }: ICPTAMAnalysisTabProps) {
  const { userProfile: profile } = useAuth();
  const [metrics, setMetrics] = useState<TAMMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.org_id && icp.id) {
      loadTAMMetrics();
    }
  }, [profile?.org_id, icp.id]);

  async function loadTAMMetrics() {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      // Get TAM from icp_profiles.tam_estimate or total accounts
      const tamEstimate = icp.tam_estimate || 0;

      // Get SAM: high-fit accounts (score >= 70) for this ICP
      const { data: samData, count: samCount } = await supabase
        .from('scores')
        .select('account_external_id', { count: 'exact' })
        .eq('org_id', profile.org_id)
        .eq('icp_id', icp.id)
        .gte('overall', 70);

      // Get SOM: high-fit accounts that have contacts (campaign ready)
      const highFitAccountIds = samData?.map(s => s.account_external_id) || [];
      
      let somCount = 0;
      if (highFitAccountIds.length > 0) {
        // Check which accounts have contacts
        const { count: contactsCount } = await supabase
          .from('Leads')
          .select('account_external_id', { count: 'exact', head: true })
          .eq('org_id', profile.org_id)
          .in('account_external_id', highFitAccountIds.slice(0, 1000)); // Limit for performance
        
        somCount = contactsCount || 0;
      }

      // Use TAM estimate from discovery, or fall back to total scored accounts
      const { count: totalScored } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .eq('icp_id', icp.id);

      const tamAccounts = tamEstimate > 0 ? tamEstimate : (totalScored || 0);
      const samAccounts = samCount || 0;

      setMetrics({
        tamAccounts,
        samAccounts,
        somAccounts: somCount,
        tamValue: tamAccounts * AVG_DEAL_SIZE,
        samValue: samAccounts * AVG_DEAL_SIZE,
        somValue: somCount * AVG_DEAL_SIZE * CONVERSION_RATE
      });
    } catch (error) {
      console.error('Error loading TAM metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.tamAccounts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TAM Analysis</CardTitle>
          <CardDescription>Total Addressable Market for {icp.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No TAM data available</p>
            <p className="text-sm">Run discovery to estimate TAM or score accounts to calculate SAM/SOM</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const samPercentage = metrics.tamAccounts > 0 ? (metrics.samAccounts / metrics.tamAccounts) * 100 : 0;
  const somPercentage = metrics.samAccounts > 0 ? (metrics.somAccounts / metrics.samAccounts) * 100 : 0;

  const segments = [
    {
      label: 'TAM',
      fullLabel: 'Total Addressable Market',
      accounts: metrics.tamAccounts,
      value: metrics.tamValue,
      percentage: 100,
      description: icp.tam_estimate ? 'From discovery/external data' : 'All accounts matching ICP criteria',
      color: 'hsl(var(--chart-1))'
    },
    {
      label: 'SAM',
      fullLabel: 'Serviceable Addressable Market',
      accounts: metrics.samAccounts,
      value: metrics.samValue,
      percentage: samPercentage,
      description: 'High-fit accounts in your database (score ≥ 70)',
      color: 'hsl(var(--chart-2))'
    },
    {
      label: 'SOM',
      fullLabel: 'Serviceable Obtainable Market',
      accounts: metrics.somAccounts,
      value: metrics.somValue,
      percentage: somPercentage,
      description: 'Campaign-ready accounts with contacts',
      color: 'hsl(var(--chart-3))'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            TAM/SAM/SOM Analysis
            {icp.tam_estimate && (
              <Badge variant="outline" className="ml-2 text-xs">External TAM</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Market opportunity sizing for {icp.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Market Size Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                {formatCurrency(metrics.tamValue)}
              </div>
              <div className="text-sm text-muted-foreground">Total Market (TAM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {metrics.tamAccounts.toLocaleString()} accounts
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--chart-2))]">
                {formatCurrency(metrics.samValue)}
              </div>
              <div className="text-sm text-muted-foreground">Serviceable (SAM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {metrics.samAccounts.toLocaleString()} high-fit
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--chart-3))]">
                {formatCurrency(metrics.somValue)}
              </div>
              <div className="text-sm text-muted-foreground">Obtainable (SOM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {metrics.somAccounts.toLocaleString()} ready
              </div>
            </div>
          </div>

          {/* Market Funnel */}
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={segment.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      style={{ borderColor: segment.color, color: segment.color }}
                    >
                      {segment.label}
                    </Badge>
                    <span className="text-sm font-medium">{segment.fullLabel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold" style={{ color: segment.color }}>
                        {formatCurrency(segment.value)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {segment.accounts.toLocaleString()} accounts
                      </div>
                    </div>
                    {index > 0 && (
                      <div className={`text-sm font-medium ${
                        segment.percentage >= 50 ? 'text-[hsl(var(--signal-high))]' :
                        segment.percentage >= 20 ? 'text-[hsl(var(--signal-medium))]' :
                        'text-[hsl(var(--signal-low))]'
                      }`}>
                        {segment.percentage.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={segment.percentage}
                  className="h-3"
                />
                
                <div className="text-xs text-muted-foreground">
                  {segment.description}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {samPercentage < 20 && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <span className="text-amber-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium">Low SAM coverage</p>
                <p className="text-xs text-muted-foreground">
                  Only {samPercentage.toFixed(0)}% of your TAM is high-fit. Consider refining ICP criteria or enriching more accounts.
                </p>
              </div>
            </div>
          )}
          
          {somPercentage < 30 && metrics.samAccounts > 0 && (
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <span className="text-blue-500 text-lg">📇</span>
              <div>
                <p className="text-sm font-medium">Contact gap identified</p>
                <p className="text-xs text-muted-foreground">
                  {(metrics.samAccounts - metrics.somAccounts).toLocaleString()} high-fit accounts lack contacts. 
                  Enrich these accounts to expand your SOM.
                </p>
              </div>
            </div>
          )}

          {samPercentage >= 50 && (
            <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <span className="text-green-500 text-lg">✅</span>
              <div>
                <p className="text-sm font-medium">Strong ICP alignment</p>
                <p className="text-xs text-muted-foreground">
                  {samPercentage.toFixed(0)}% of your market matches your ICP criteria. Your targeting is well-calibrated.
                </p>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
            <strong>Assumptions:</strong> ${AVG_DEAL_SIZE.toLocaleString()} average deal size, {(CONVERSION_RATE * 100)}% conversion rate for SOM calculation.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
