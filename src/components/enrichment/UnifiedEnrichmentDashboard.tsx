import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react';
import { useRealtimeEnrichment, EnrichmentJob } from '@/hooks/use-realtime-enrichment';
import { EnrichmentJobCard } from './EnrichmentJobCard';
import { EnrichmentSourceBreakdown } from './EnrichmentSourceBreakdown';
import { EnrichmentHistory } from './EnrichmentHistory';
import { toast } from 'sonner';

interface HistoricalJob {
  id: string;
  provider: string;
  status: string;
  enriched_records: number;
  failed_records: number;
  total_records: number;
  completed_at: string | null;
  started_at: string | null;
  source_breakdown: Record<string, { attempted: number; enriched: number; failed: number }> | null;
}

interface AggregateStats {
  totalEnriched: number;
  totalFailed: number;
  totalProcessed: number;
  avgSuccessRate: number;
  sourceBreakdown: {
    apollo: { attempted: number; enriched: number; failed: number };
    pdl: { attempted: number; enriched: number; failed: number };
    ai: { attempted: number; enriched: number; failed: number };
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
    isConnected, 
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
      // Fetch recent completed/failed jobs
      const { data: jobs, error } = await supabase
        .from('enrichment_jobs')
        .select('id, provider, status, enriched_records, failed_records, total_records, completed_at, started_at, source_breakdown')
        .eq('org_id', userProfile.org_id)
        .in('status', ['completed', 'completed_with_errors', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistoricalJobs((jobs || []) as HistoricalJob[]);

      // Calculate aggregate stats
      const { data: aggregates } = await supabase
        .from('enrichment_jobs')
        .select('enriched_records, failed_records, total_records, source_breakdown')
        .eq('org_id', userProfile.org_id)
        .in('status', ['completed', 'completed_with_errors']);

      if (aggregates) {
        const totals = aggregates.reduce(
          (acc, job) => {
            acc.totalEnriched += job.enriched_records || 0;
            acc.totalFailed += job.failed_records || 0;
            acc.totalProcessed += job.total_records || 0;
            
            // Aggregate source breakdown
            const breakdown = job.source_breakdown as Record<string, { attempted?: number; enriched?: number; failed?: number }> | null;
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
              if (breakdown.ai) {
                acc.sourceBreakdown.ai.attempted += breakdown.ai.attempted || 0;
                acc.sourceBreakdown.ai.enriched += breakdown.ai.enriched || 0;
                acc.sourceBreakdown.ai.failed += breakdown.ai.failed || 0;
              }
            }
            
            return acc;
          },
          {
            totalEnriched: 0,
            totalFailed: 0,
            totalProcessed: 0,
            avgSuccessRate: 0,
            sourceBreakdown: {
              apollo: { attempted: 0, enriched: 0, failed: 0 },
              pdl: { attempted: 0, enriched: 0, failed: 0 },
              ai: { attempted: 0, enriched: 0, failed: 0 },
            },
          }
        );

        totals.avgSuccessRate = totals.totalProcessed > 0 
          ? Math.round((totals.totalEnriched / totals.totalProcessed) * 100) 
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
                variant={isConnected ? 'default' : 'destructive'} 
                className="flex items-center gap-1"
              >
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    Live
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
          {/* Overall Stats */}
          {aggregateStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Total Enriched</p>
                <p className="text-2xl font-bold text-primary">
                  {aggregateStats.totalEnriched.toLocaleString()}
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
