import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Globe
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
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" />
            Enrichment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const enrichmentRate = metrics.totalAccounts > 0 
    ? Math.round((metrics.enrichedAccounts / metrics.totalAccounts) * 100) 
    : 0;

  const getStatusColor = (pct: number) => {
    if (pct >= 80) return 'text-green-600 bg-green-500/10';
    if (pct >= 50) return 'text-amber-600 bg-amber-500/10';
    return 'text-red-600 bg-red-500/10';
  };

  const fieldStats = [
    { label: 'Employee Count', value: metrics.withEmployeeCount, icon: Users, color: 'text-blue-500' },
    { label: 'Revenue', value: metrics.withRevenue, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Industry', value: metrics.withIndustry, icon: Building2, color: 'text-purple-500' },
    { label: 'Domain', value: metrics.withDomain, icon: Globe, color: 'text-orange-500' },
  ];

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" />
            Enrichment Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunEnrichmentAgent}
            disabled={isRunningAgent}
            className="h-8"
          >
            {isRunningAgent ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Run Agent</span>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-4">
        {/* Overall Enrichment - Hero Section */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Overall Enrichment</span>
            {enrichmentRate >= 80 ? (
              <Badge className="gap-1 bg-green-500/20 text-green-600 border-green-500/30">
                <CheckCircle2 className="h-3 w-3" />
                Excellent
              </Badge>
            ) : enrichmentRate >= 50 ? (
              <Badge className="gap-1 bg-amber-500/20 text-amber-600 border-amber-500/30">
                Good
              </Badge>
            ) : (
              <Badge className="gap-1 bg-red-500/20 text-red-600 border-red-500/30">
                <AlertCircle className="h-3 w-3" />
                Needs Work
              </Badge>
            )}
          </div>
          
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-bold text-primary">{enrichmentRate}%</span>
            <span className="text-sm text-muted-foreground mb-1">enriched</span>
          </div>
          
          <Progress value={enrichmentRate} className="h-2 mb-2" />
          
          <p className="text-xs text-muted-foreground">
            {metrics.enrichedAccounts.toLocaleString()} of {metrics.totalAccounts.toLocaleString()} accounts
          </p>
        </div>

        {/* Field Coverage Grid */}
        <div className="grid grid-cols-2 gap-2">
          {fieldStats.map(stat => {
            const pct = metrics.totalAccounts > 0 
              ? Math.round((stat.value / metrics.totalAccounts) * 100) 
              : 0;
            const statusClass = getStatusColor(pct);
            
            return (
              <div 
                key={stat.label} 
                className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${statusClass}`}>
                    <stat.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {stat.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold">{pct}%</span>
                  <span className="text-xs text-muted-foreground">
                    ({stat.value.toLocaleString()})
                  </span>
                </div>
                <Progress value={pct} className="h-1 mt-2" />
              </div>
            );
          })}
        </div>

        {/* Enrichment Sources */}
        {(metrics.apolloEnriched > 0 || metrics.pdlEnriched > 0 || metrics.aiEstimated > 0) && (
          <div className="pt-3 border-t">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Sources</p>
            <div className="flex flex-wrap gap-2">
              {metrics.apolloEnriched > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/5 border-blue-500/20 text-blue-600">
                  Apollo: {metrics.apolloEnriched.toLocaleString()}
                </Badge>
              )}
              {metrics.pdlEnriched > 0 && (
                <Badge variant="outline" className="text-xs bg-purple-500/5 border-purple-500/20 text-purple-600">
                  PDL: {metrics.pdlEnriched.toLocaleString()}
                </Badge>
              )}
              {metrics.aiEstimated > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-500/5 border-amber-500/20 text-amber-600">
                  AI: {metrics.aiEstimated.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
