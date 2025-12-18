import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Database,
  Zap,
  Target,
  Activity,
  Bot,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface AgentRun {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  records_affected: number | null;
  error_message: string | null;
  agent: {
    name: string;
    agent_type: string;
  } | null;
}

interface SystemHealth {
  crmSync: {
    status: 'healthy' | 'warning' | 'error';
    lastSync: string | null;
    provider: string | null;
    recordsSynced: number;
  };
  enrichment: {
    status: 'healthy' | 'warning' | 'error';
    coverage: {
      employee_count: number;
      revenue_range: number;
      industry: number;
      overall: number;
    };
    activeJobs: number;
  };
  scoring: {
    status: 'healthy' | 'warning' | 'error';
    lastRun: string | null;
    accountsScored: number;
    totalAccounts: number;
    activeJobs: number;
  };
  automations: {
    status: 'healthy' | 'warning' | 'error';
    enabled: string[];
    lastRuns: Record<string, string | null>;
  };
}

// Simple time ago formatter
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
};

interface SystemHealthDashboardProps {
  onViewAgentRun?: (runId: string) => void;
}

export function SystemHealthDashboard({ onViewAgentRun }: SystemHealthDashboardProps = {}) {
  const { userProfile } = useAuth();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealthData = useCallback(async () => {
    if (!userProfile?.org_id) return;
    
    setRefreshing(true);
    try {
      // Check CRM sync status
      const { data: integrations } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('last_sync_at', { ascending: false, nullsFirst: false })
        .limit(1) as any;

      const lastIntegration = integrations?.[0];
      
      // Check enrichment coverage
      const { data: accounts } = await supabase
        .from('accounts')
        .select('employee_count, revenue_range, industry_norm')
        .eq('org_id', userProfile.org_id);

      const total = accounts?.length || 0;
      const withEmployeeCount = accounts?.filter(a => a.employee_count != null).length || 0;
      const withRevenue = accounts?.filter(a => a.revenue_range != null).length || 0;
      const withIndustry = accounts?.filter(a => a.industry_norm != null).length || 0;

      // Check active enrichment jobs
      const { data: enrichmentJobs } = await supabase
        .from('enrichment_jobs')
        .select('id')
        .eq('org_id', userProfile.org_id)
        .in('status', ['pending', 'processing']);

      // Check scoring status
      const { data: scores } = await supabase
        .from('scores')
        .select('computed_at')
        .eq('org_id', userProfile.org_id)
        .order('computed_at', { ascending: false })
        .limit(1);

      const { count: scoredCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      const { data: scoringJobs } = await supabase
        .from('bulk_scoring_jobs')
        .select('id')
        .eq('org_id', userProfile.org_id)
        .eq('status', 'processing');

      // Check automation settings
      const { data: automations } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('org_id', userProfile.org_id);

      const enabledAutomations = automations?.filter(a => a.enabled).map(a => a.setting_key) || [];
      const lastRuns: Record<string, string | null> = {};
      automations?.forEach(a => {
        lastRuns[a.setting_key] = a.last_run_at;
      });

      // Fetch recent agent runs
      const { data: recentRuns } = await supabase
        .from('ai_agent_runs')
        .select(`
          id, status, started_at, completed_at, records_processed, records_affected, error_message,
          agent:ai_agents(name, agent_type)
        `)
        .eq('agent:ai_agents.org_id', userProfile.org_id)
        .order('started_at', { ascending: false })
        .limit(5);

      setAgentRuns((recentRuns || []) as AgentRun[]);

      // Calculate overall coverage
      const overallCoverage = total > 0 
        ? Math.round(((withEmployeeCount + withRevenue + withIndustry) / (total * 3)) * 100)
        : 0;

      setHealth({
        crmSync: {
          status: lastIntegration?.last_sync_at 
            ? (new Date().getTime() - new Date(lastIntegration.last_sync_at).getTime() > 24 * 60 * 60 * 1000 ? 'warning' : 'healthy')
            : 'error',
          lastSync: lastIntegration?.last_sync_at || null,
          provider: lastIntegration?.provider_name || null,
          recordsSynced: 0
        },
        enrichment: {
          status: overallCoverage >= 80 ? 'healthy' : overallCoverage >= 50 ? 'warning' : 'error',
          coverage: {
            employee_count: total > 0 ? Math.round((withEmployeeCount / total) * 100) : 0,
            revenue_range: total > 0 ? Math.round((withRevenue / total) * 100) : 0,
            industry: total > 0 ? Math.round((withIndustry / total) * 100) : 0,
            overall: overallCoverage
          },
          activeJobs: enrichmentJobs?.length || 0
        },
        scoring: {
          status: (scoredCount || 0) > 0 ? 'healthy' : 'warning',
          lastRun: scores?.[0]?.computed_at || null,
          accountsScored: scoredCount || 0,
          totalAccounts: total,
          activeJobs: scoringJobs?.length || 0
        },
        automations: {
          status: enabledAutomations.length > 0 ? 'healthy' : 'warning',
          enabled: enabledAutomations,
          lastRuns
        }
      });
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.org_id]);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadHealthData();
      const interval = setInterval(() => {
        loadHealthData();
      }, 30000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.org_id]);

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: 'healthy' | 'warning' | 'error') => {
    const config = {
      healthy: { variant: 'default' as const, label: 'Healthy', className: 'bg-green-500' },
      warning: { variant: 'secondary' as const, label: 'Warning', className: 'bg-amber-500' },
      error: { variant: 'destructive' as const, label: 'Error', className: 'bg-red-500' }
    };
    const { variant, label, className } = config[status];
    return <Badge variant={variant} className={className}>{label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>;
  }

  if (!health) {
    return <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>Failed to load system health data</AlertDescription>
    </Alert>;
  }

  return (
    <div className="space-y-6">
      {/* Overall Status Alert */}
      {(health.crmSync.status === 'error' || health.enrichment.status === 'error' || health.scoring.status === 'error') && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Critical system health issues detected. Please review the sections below.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* CRM Sync Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">CRM Sync</CardTitle>
            </div>
            {getStatusIcon(health.crmSync.status)}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge(health.crmSync.status)}
              {health.crmSync.provider ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Provider: <span className="font-medium">{health.crmSync.provider}</span>
                  </p>
                  {health.crmSync.lastSync ? (
                    <p className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Last sync: {formatTimeAgo(health.crmSync.lastSync)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Never synced</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No CRM connected</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enrichment Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">Data Enrichment</CardTitle>
            </div>
            {getStatusIcon(health.enrichment.status)}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getStatusBadge(health.enrichment.status)}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Overall Coverage</span>
                  <span className="font-medium">{health.enrichment.coverage.overall}%</span>
                </div>
                <Progress value={health.enrichment.coverage.overall} className="h-2" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Employees</p>
                  <p className="font-medium">{health.enrichment.coverage.employee_count}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-medium">{health.enrichment.coverage.revenue_range}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Industry</p>
                  <p className="font-medium">{health.enrichment.coverage.industry}%</p>
                </div>
              </div>
              {health.enrichment.activeJobs > 0 && (
                <p className="text-xs text-muted-foreground">
                  <RefreshCw className="inline h-3 w-3 mr-1 animate-spin" />
                  {health.enrichment.activeJobs} job{health.enrichment.activeJobs > 1 ? 's' : ''} running
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">Account Scoring</CardTitle>
            </div>
            {getStatusIcon(health.scoring.status)}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge(health.scoring.status)}
              <p className="text-sm text-muted-foreground">
                {health.scoring.accountsScored} / {health.scoring.totalAccounts} accounts scored
              </p>
              {health.scoring.lastRun ? (
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Last run: {formatTimeAgo(health.scoring.lastRun)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Never scored</p>
              )}
              {health.scoring.activeJobs > 0 && (
                <p className="text-xs text-muted-foreground">
                  <RefreshCw className="inline h-3 w-3 mr-1 animate-spin" />
                  {health.scoring.activeJobs} job{health.scoring.activeJobs > 1 ? 's' : ''} running
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Automation Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">Automations</CardTitle>
            </div>
            {getStatusIcon(health.automations.status)}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge(health.automations.status)}
              <p className="text-sm text-muted-foreground">
                {health.automations.enabled.length} automation{health.automations.enabled.length !== 1 ? 's' : ''} enabled
              </p>
              {health.automations.enabled.length > 0 ? (
                <div className="space-y-1">
                  {health.automations.enabled.slice(0, 3).map(key => (
                    <div key={key} className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>{key.replace(/_/g, ' ')}</span>
                      {health.automations.lastRuns[key] ? (
                        <span className="text-green-600">
                          {formatTimeAgo(health.automations.lastRuns[key]!)}
                        </span>
                      ) : (
                        <span className="text-amber-600">Not run yet</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No automations configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Agent Runs */}
      {agentRuns.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">Recent Agent Runs</CardTitle>
            </div>
            <Badge variant="secondary">{agentRuns.length} runs</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {agentRuns.map(run => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => onViewAgentRun?.(run.id)}
                >
                  <div className="flex items-center gap-3">
                    {run.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : run.status === 'failed' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : run.status === 'running' ? (
                      <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{run.agent?.name || 'Unknown Agent'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(run.started_at)} • {run.records_processed ?? 0} processed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {run.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}