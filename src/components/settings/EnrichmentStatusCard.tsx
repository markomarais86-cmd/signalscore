import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Building2,
  Users,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useState } from 'react';

interface EnrichmentMetrics {
  totalAccounts: number;
  enrichedAccounts: number;
  withEmployeeCount: number;
  withRevenue: number;
  withIndustry: number;
  withDomain: number;
  apolloEnriched: number;
  pdlEnriched: number;
  aiEstimated: number;
}

export function EnrichmentStatusCard() {
  const { userProfile } = useAuth();
  const [isRunningAgent, setIsRunningAgent] = useState(false);

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['enrichment-metrics', userProfile?.org_id],
    queryFn: async (): Promise<EnrichmentMetrics> => {
      if (!userProfile?.org_id) throw new Error('No org');

      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('enriched_at, enriched_from, employee_count, revenue_range, industry_norm, domain')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      const total = accounts?.length || 0;
      const enriched = accounts?.filter(a => a.enriched_at).length || 0;
      const withEmp = accounts?.filter(a => a.employee_count).length || 0;
      const withRev = accounts?.filter(a => a.revenue_range).length || 0;
      const withInd = accounts?.filter(a => a.industry_norm).length || 0;
      const withDomain = accounts?.filter(a => a.domain).length || 0;
      
      const apollo = accounts?.filter(a => a.enriched_from === 'apollo').length || 0;
      const pdl = accounts?.filter(a => a.enriched_from === 'pdl').length || 0;
      const ai = accounts?.filter(a => a.enriched_from === 'ai_estimate').length || 0;

      return {
        totalAccounts: total,
        enrichedAccounts: enriched,
        withEmployeeCount: withEmp,
        withRevenue: withRev,
        withIndustry: withInd,
        withDomain: withDomain,
        apolloEnriched: apollo,
        pdlEnriched: pdl,
        aiEstimated: ai
      };
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000
  });

  const handleRunEnrichmentAgent = async () => {
    if (!userProfile?.org_id) return;

    setIsRunningAgent(true);
    try {
      // Find the data enrichment agent
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('org_id', userProfile.org_id)
        .eq('agent_type', 'data_enrichment')
        .single();

      if (!agent) {
        toast.error('Data Enrichment Agent not found. Please set it up first.');
        return;
      }

      const { error } = await supabase.functions.invoke('agent-data-enrichment', {
        body: { org_id: userProfile.org_id, agent_id: agent.id }
      });

      if (error) throw error;

      toast.success('Data Enrichment Agent started. Check notifications for progress.');
      
      // Refetch after a delay
      setTimeout(() => refetch(), 5000);
    } catch (error: any) {
      console.error('Error running enrichment agent:', error);
      toast.error(error.message || 'Failed to start enrichment agent');
    } finally {
      setIsRunningAgent(false);
    }
  };

  if (isLoading || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Enrichment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const enrichmentRate = metrics.totalAccounts > 0 
    ? Math.round((metrics.enrichedAccounts / metrics.totalAccounts) * 100) 
    : 0;

  const fieldStats = [
    { label: 'Employee Count', value: metrics.withEmployeeCount, icon: Users },
    { label: 'Revenue Range', value: metrics.withRevenue, icon: TrendingUp },
    { label: 'Industry', value: metrics.withIndustry, icon: Building2 },
    { label: 'Domain', value: metrics.withDomain, icon: Zap },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Enrichment Status
            </CardTitle>
            <CardDescription>
              {metrics.totalAccounts.toLocaleString()} total accounts
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunEnrichmentAgent}
            disabled={isRunningAgent}
          >
            {isRunningAgent ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Run Agent</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Enrichment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Enrichment</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{enrichmentRate}%</span>
              {enrichmentRate >= 80 ? (
                <Badge className="gap-1 bg-green-500/10 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Excellent
                </Badge>
              ) : enrichmentRate >= 50 ? (
                <Badge variant="secondary" className="gap-1">
                  Good
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Low
                </Badge>
              )}
            </div>
          </div>
          <Progress value={enrichmentRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {metrics.enrichedAccounts.toLocaleString()} of {metrics.totalAccounts.toLocaleString()} accounts enriched
          </p>
        </div>

        {/* Field Coverage */}
        <div className="grid grid-cols-2 gap-3">
          {fieldStats.map(stat => {
            const pct = metrics.totalAccounts > 0 
              ? Math.round((stat.value / metrics.totalAccounts) * 100) 
              : 0;
            return (
              <div key={stat.label} className="p-3 rounded-lg bg-muted/30 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <stat.icon className="h-3 w-3" />
                  {stat.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-semibold">{pct}%</span>
                  <span className="text-xs text-muted-foreground">
                    ({stat.value.toLocaleString()})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enrichment Sources */}
        <div className="pt-2 border-t">
          <p className="text-xs font-medium mb-2">Enrichment Sources</p>
          <div className="flex flex-wrap gap-2">
            {metrics.apolloEnriched > 0 && (
              <Badge variant="outline" className="text-xs">
                Apollo: {metrics.apolloEnriched.toLocaleString()}
              </Badge>
            )}
            {metrics.pdlEnriched > 0 && (
              <Badge variant="outline" className="text-xs">
                PDL: {metrics.pdlEnriched.toLocaleString()}
              </Badge>
            )}
            {metrics.aiEstimated > 0 && (
              <Badge variant="outline" className="text-xs">
                AI Estimates: {metrics.aiEstimated.toLocaleString()}
              </Badge>
            )}
            {metrics.apolloEnriched === 0 && metrics.pdlEnriched === 0 && metrics.aiEstimated === 0 && (
              <span className="text-xs text-muted-foreground">
                No external enrichment yet
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
