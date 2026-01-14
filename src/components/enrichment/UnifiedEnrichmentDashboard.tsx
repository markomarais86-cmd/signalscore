import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Activity, Loader2 } from 'lucide-react';
import { useRealtimeEnrichment, EnrichmentJob, ConnectionStatus } from '@/hooks/use-realtime-enrichment';
import { EnrichmentJobCard } from './EnrichmentJobCard';
import { EnrichmentSourceBreakdown } from './EnrichmentSourceBreakdown';
import { EnrichmentHistory } from './EnrichmentHistory';
import { toast } from 'sonner';

interface HistoricalJob {
  id: string;
  provider: string;
  status: string;
  enriched_records: number;
  accounts_enriched: number;
  fields_enriched: number;
  failed_records: number;
  total_records: number;
  processed_records: number;
  completed_at: string | null;
  started_at: string | null;
  source_breakdown: Record<string, { attempted: number; enriched: number; failed: number; accounts_enriched?: number; fields_enriched?: number }> | null;
}

interface AggregateStats {
  totalAccountsEnriched: number;
  totalFieldsEnriched: number;
  totalFailed: number;
  totalProcessed: number;
  avgSuccessRate: number;
  sourceBreakdown: {
    apollo: { attempted: number; enriched: number; failed: number };
    pdl: { attempted: number; enriched: number; failed: number };
    launch_pulse: { attempted: number; enriched: number; failed: number; accounts_enriched: number; fields_enriched: number };
  };
}

export function UnifiedEnrichmentDashboard() {
  const { userProfile } = useAuth();
  const [historicalJobs, setHistoricalJobs] = useState<HistoricalJob[]>([]);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { 
    jobs: activeJobs, 
    pausedJobs, 
    connectionStatus, 
    refetch 
  } = useRealtimeEnrichment({
    orgId: userProfile?.org_id || null,
    enabled: !!userProfile?.org_id,
    onComplete: (job) => {
      toast.success(`Enrichment completed: ${job.enriched_records} records enriched`);
      loadHistoricalData();
    },
    onError: (job) => {
      toast.error(`Enrichment failed: ${job.error_message || 'Unknown error'}`);
    },
  });

  const loadHistoricalData = useCallback(async () => {
    if (!userProfile?.org_id) return;

    try {
      // Fetch recent completed/failed jobs with new metrics columns
      const { data: jobs, error } = await supabase
        .from('enrichment_jobs')
        .select('id, provider, status, enriched_records, accounts_enriched, fields_enriched, failed_records, total_records, processed_records, completed_at, started_at, source_breakdown')
        .eq('org_id', userProfile.org_id)
        .in('status', ['completed', 'completed_with_errors', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistoricalJobs((jobs || []) as HistoricalJob[]);

      // Calculate aggregate stats with new metrics
      const { data: aggregates } = await supabase
        .from('enrichment_jobs')
        .select('enriched_records, accounts_enriched, fields_enriched, failed_records, total_records, processed_records, source_breakdown')
        .eq('org_id', userProfile.org_id)
        .in('status', ['completed', 'completed_with_errors']);

      if (aggregates) {
        const totals = aggregates.reduce(
          (acc, job) => {
            // Use new columns if available, fallback to legacy
            const accountsEnriched = job.accounts_enriched || job.enriched_records || 0;
            const fieldsEnriched = job.fields_enriched || 0;
            const processed = job.processed_records || job.total_records || 0;
            
            acc.totalAccountsEnriched += accountsEnriched;
            acc.totalFieldsEnriched += fieldsEnriched;
            acc.totalFailed += job.failed_records || 0;
            acc.totalProcessed += processed;
            
            // Aggregate source breakdown
            const breakdown = job.source_breakdown as Record<string, { attempted?: number; enriched?: number; failed?: number; accounts_enriched?: number; fields_enriched?: number }> | null;
            if (breakdown) {
              if (breakdown.apollo) {
                acc.sourceBreakdown.apollo.attempted += breakdown.apollo.attempted || 0;
                acc.sourceBreakdown.apollo.enriched += breakdown.apollo.enriched || 0;
                acc.sourceBreakdown.apollo.failed += breakdown.apollo.failed || 0;
              }
              if (breakdown.pdl) {
                acc.sourceBreakdown.pdl.attempted += breakdown.pdl.attempted || 0;
                acc.sourceBreakdown.pdl.enriched += breakdown.pdl.enriched || 0;
                acc.sourceBreakdown.pdl.failed += breakdown.pdl.failed || 0;
              }
              // Consolidate all AI/Launch Pulse sources into launch_pulse
              if (breakdown.ai || breakdown.launch_pulse) {
                const aiData = breakdown.ai || { attempted: 0, enriched: 0, failed: 0 };
                const lpData = breakdown.launch_pulse || { attempted: 0, enriched: 0, failed: 0, accounts_enriched: 0, fields_enriched: 0 };
                acc.sourceBreakdown.launch_pulse.attempted += (aiData.attempted || 0) + (lpData.attempted || 0);
                acc.sourceBreakdown.launch_pulse.enriched += (aiData.enriched || 0) + (lpData.accounts_enriched || lpData.enriched || 0);
                acc.sourceBreakdown.launch_pulse.failed += (aiData.failed || 0) + (lpData.failed || 0);
                acc.sourceBreakdown.launch_pulse.accounts_enriched += lpData.accounts_enriched || lpData.enriched || 0;
                acc.sourceBreakdown.launch_pulse.fields_enriched += lpData.fields_enriched || 0;
              }
            }
            
            return acc;
          },
          {
            totalAccountsEnriched: 0,
            totalFieldsEnriched: 0,
            totalFailed: 0,
            totalProcessed: 0,
            avgSuccessRate: 0,
            sourceBreakdown: {
              apollo: { attempted: 0, enriched: 0, failed: 0 },
              pdl: { attempted: 0, enriched: 0, failed: 0 },
              launch_pulse: { attempted: 0, enriched: 0, failed: 0, accounts_enriched: 0, fields_enriched: 0 },
            },
          }
        );

        // Calculate success rate based on ACCOUNTS enriched vs PROCESSED (not fields)
        totals.avgSuccessRate = totals.totalProcessed > 0 
          ? Math.round((totals.totalAccountsEnriched / totals.totalProcessed) * 100) 
          : 0;

        setAggregateStats(totals);
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  }, [userProfile?.org_id]);

  useEffect(() => {
    loadHistoricalData();
  }, [loadHistoricalData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), loadHistoricalData()]);
    setIsRefreshing(false);
  };

  const allActiveJobs = [...activeJobs.filter(j => j.status === 'processing' || j.status === 'pending'), ...pausedJobs];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Unified Enrichment Dashboard
              </CardTitle>
              <CardDescription>
                Real-time monitoring of all enrichment jobs with source breakdown
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'connecting' ? 'secondary' : 'destructive'} 
                className="flex items-center gap-1"
              >
                {connectionStatus === 'connected' ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    Live
                  </>
                ) : connectionStatus === 'connecting' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Disconnected
                  </>
                )}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Overall Stats - Updated to show correct metrics */}
          {aggregateStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Accounts Enriched</p>
                <p className="text-2xl font-bold text-primary">
                  {aggregateStats.totalAccountsEnriched.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Data Points Added</p>
                <p className="text-2xl font-bold text-blue-600">
                  {aggregateStats.totalFieldsEnriched.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Total Processed</p>
                <p className="text-2xl font-bold">
                  {aggregateStats.totalProcessed.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Failed Records</p>
                <p className="text-2xl font-bold text-destructive">
                  {aggregateStats.totalFailed.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className={`text-2xl font-bold ${
                  aggregateStats.avgSuccessRate >= 80 ? 'text-green-600' : 
                  aggregateStats.avgSuccessRate >= 60 ? 'text-yellow-600' : 'text-destructive'
                }`}>
                  {aggregateStats.avgSuccessRate}%
                </p>
              </div>
            </div>
          )}

          {/* Active Jobs */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Active Jobs
              {allActiveJobs.length > 0 && (
                <Badge variant="secondary">{allActiveJobs.length}</Badge>
              )}
            </h3>
            
            {allActiveJobs.length === 0 ? (
              <div className="p-8 text-center border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">No active enrichment jobs</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start an enrichment from the Smart Enrichment panel
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allActiveJobs.map((job) => (
                  <EnrichmentJobCard key={job.id} job={job} onRefresh={refetch} />
                ))}
              </div>
            )}
          </div>

          {/* Source Breakdown */}
          {aggregateStats && (
            <EnrichmentSourceBreakdown sourceBreakdown={aggregateStats.sourceBreakdown} />
          )}

          {/* Recent History */}
          <EnrichmentHistory jobs={historicalJobs} />
        </CardContent>
      </Card>
    </div>
  );
}
