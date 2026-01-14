import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, TrendingUp, Database, Sparkles, RefreshCw, ArrowLeftRight, Loader2, Zap, MapPin } from 'lucide-react';

interface DataQualityMetrics {
  totalAccounts: number;
  withPrimaryIndustry: number;
  withSubIndustry: number;
  withEmployeeCount: number;
  withRevenue: number;
  withCountry: number;
  standardizedIndustries: number;
  overallCompleteness: number;
}

interface SyncOpportunities {
  leads_can_enrich: number;
  accounts_can_enrich: number;
  pending_conflicts: number;
}

interface SyncProgress {
  status: 'idle' | 'starting' | 'processing' | 'completed' | 'error';
  phase?: string;
  jobId?: string;
  message?: string;
}

export function DataQualityDashboard() {
  const { userProfile } = useAuth();
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [syncOpportunities, setSyncOpportunities] = useState<SyncOpportunities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ status: 'idle' });

  const isStandardizing = actionInProgress === 'standardize';
  const isSyncing = actionInProgress === 'sync' || syncProgress.status === 'processing';
  const isResolvingConflicts = actionInProgress === 'resolve';
  const isEnrichingHQ = actionInProgress === 'hq-enrich';

  useEffect(() => {
    loadMetrics();
    loadSyncOpportunities();
  }, [userProfile?.org_id]);

  const loadMetrics = async () => {
    if (!userProfile?.org_id) return;

    try {
      setIsLoading(true);

      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('industry_norm, industry_raw, employee_count, revenue_range, country')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      const total = accounts?.length || 0;
      const withPrimary = accounts?.filter(a => a.industry_norm).length || 0;
      const withSub = accounts?.filter(a => a.industry_raw).length || 0;
      const withEmp = accounts?.filter(a => a.employee_count).length || 0;
      const withRev = accounts?.filter(a => a.revenue_range).length || 0;
      const withCountry = accounts?.filter(a => a.country).length || 0;

      const standardized = withPrimary;

      const completeness = total > 0 
        ? ((withPrimary + withSub + withEmp + withRev + withCountry) / (total * 5)) * 100 
        : 0;

      setMetrics({
        totalAccounts: total,
        withPrimaryIndustry: withPrimary,
        withSubIndustry: withSub,
        withEmployeeCount: withEmp,
        withRevenue: withRev,
        withCountry: withCountry,
        standardizedIndustries: standardized,
        overallCompleteness: Math.round(completeness)
      });
    } catch (error) {
      console.error('Error loading data quality metrics:', error);
      toast.error('Failed to load data quality metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSyncOpportunities = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase.rpc('get_firmographic_sync_opportunities', {
        p_org_id: userProfile.org_id
      });

      if (error) throw error;
      setSyncOpportunities(data as unknown as SyncOpportunities);
    } catch (error) {
      console.error('Error loading sync opportunities:', error);
    }
  };

  const handleBidirectionalSync = async () => {
    setActionInProgress('sync');
    setSyncProgress({ status: 'starting', message: 'Starting sync...' });
    
    try {
      // Use the new batched orchestrator instead of direct RPC
      const { data, error } = await supabase.functions.invoke('bidirectional-sync-orchestrator', {
        body: { org_id: userProfile?.org_id }
      });
      
      if (error) throw error;
      
      if (data?.status === 'completed') {
        setSyncProgress({ status: 'completed', message: `Updated ${data.updated} records` });
        toast.success(`Sync complete: Updated ${data.updated} records`);
        loadMetrics();
        loadSyncOpportunities();
      } else if (data?.status === 'continuing') {
        setSyncProgress({ 
          status: 'processing', 
          jobId: data.job_id,
          phase: data.phase,
          message: `Syncing ${data.phase === 'to_accounts' ? 'accounts' : 'leads'}... (${data.updated_so_far} updated so far)`
        });
        toast.info('Sync started - processing in background...');
        
        // Poll for completion
        pollSyncJob(data.job_id);
      } else {
        toast.success('Sync initiated');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncProgress({ status: 'error', message: error instanceof Error ? error.message : 'Sync failed' });
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const pollSyncJob = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;
    
    const checkStatus = async () => {
      // Use type assertion since sync_jobs table was just created
      const { data: job, error } = await supabase
        .from('sync_jobs' as any)
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) {
        console.error('Poll error:', error);
        return;
      }
      
      const syncJob = job as unknown as {
        id: string;
        status: string;
        direction: string;
        updated_records: number;
        processed_records: number;
        total_records: number;
      } | null;
      
      if (syncJob?.status === 'completed') {
        setSyncProgress({ status: 'completed', message: `Updated ${syncJob.updated_records} records` });
        toast.success(`Sync complete: Updated ${syncJob.updated_records} records`);
        loadMetrics();
        loadSyncOpportunities();
        return;
      }
      
      if (syncJob?.status === 'processing' && attempts < maxAttempts) {
        attempts++;
        setSyncProgress({
          status: 'processing',
          jobId,
          phase: syncJob.direction,
          message: `Syncing ${syncJob.direction === 'to_accounts' ? 'accounts' : 'leads'}... (${syncJob.updated_records || 0} updated)`
        });
        setTimeout(checkStatus, 5000); // Check every 5 seconds
      }
    };
    
    setTimeout(checkStatus, 3000); // Start checking after 3 seconds
  };

  const handleDetectConflicts = async () => {
    setActionInProgress('conflicts');
    try {
      const { data, error } = await supabase.rpc('detect_firmographic_conflicts', {
        p_org_id: userProfile?.org_id
      });
      
      if (error) throw error;
      
      toast.success(`Found ${data || 0} conflicts to review`);
      loadSyncOpportunities();
    } catch (error) {
      console.error('Conflict detection error:', error);
      toast.error(error instanceof Error ? error.message : "Detection failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResolveConflicts = async () => {
    setActionInProgress('resolve');
    try {
      const { data, error } = await supabase.functions.invoke('resolve-firmographic-conflicts', {
        body: { org_id: userProfile?.org_id, auto_apply: true }
      });
      
      if (error) throw error;
      
      toast.success(`Resolved ${data?.resolved || 0} conflicts`);
      loadSyncOpportunities();
    } catch (error) {
      console.error('Resolution error:', error);
      toast.error(error instanceof Error ? error.message : "Resolution failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleEnrichHQAddresses = async () => {
    setActionInProgress('hq-enrich');
    try {
      const { data, error } = await supabase.functions.invoke('enrich-hq-address', {
        body: { org_id: userProfile?.org_id, max_accounts: 100 }
      });
      
      if (error) throw error;
      
      toast.success(`Enriched ${data?.enriched || 0} accounts (${data?.failed || 0} failed) via ${data?.provider || 'unknown'}`);
      loadMetrics();
    } catch (error) {
      console.error('HQ enrichment error:', error);
      toast.error(error instanceof Error ? error.message : "Enrichment failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleStandardizeAll = async () => {
    if (!metrics) return;
    setActionInProgress('standardize');
    
    try {
      const { data: accounts, error: fetchError } = await supabase
        .from('accounts')
        .select('id, industry_raw')
        .eq('org_id', userProfile?.org_id)
        .is('industry_norm', null)
        .not('industry_raw', 'is', null)
        .limit(100);

      if (fetchError) throw fetchError;

      let standardized = 0;
      for (const account of accounts || []) {
        const { data, error } = await supabase.functions.invoke('standardize-industry', {
          body: { industry_raw: account.industry_raw }
        });
        
        if (!error && data?.industry_norm) {
          await supabase
            .from('accounts')
            .update({ 
              industry_norm: data.industry_norm,
              sub_industry: data.sub_industry 
            })
            .eq('id', account.id);
          standardized++;
        }
      }

      toast.success(`Standardized ${standardized} industries`);
      loadMetrics();
    } catch (error) {
      console.error('Standardization error:', error);
      toast.error(error instanceof Error ? error.message : "Standardization failed");
    } finally {
      setActionInProgress(null);
    }
  };

  if (isLoading || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const standardizationPercent = metrics.totalAccounts > 0
    ? Math.round((metrics.standardizedIndustries / metrics.totalAccounts) * 100)
    : 0;

  const fieldCompleteness = [
    { label: 'Primary Industry', value: metrics.withPrimaryIndustry, total: metrics.totalAccounts },
    { label: 'Sub-Industry', value: metrics.withSubIndustry, total: metrics.totalAccounts },
    { label: 'Employee Count', value: metrics.withEmployeeCount, total: metrics.totalAccounts },
    { label: 'Revenue Range', value: metrics.withRevenue, total: metrics.totalAccounts },
    { label: 'Geography', value: metrics.withCountry, total: metrics.totalAccounts }
  ];

  const totalSyncOpportunities = syncOpportunities 
    ? syncOpportunities.leads_can_enrich + syncOpportunities.accounts_can_enrich 
    : 0;

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Quality Overview
          </CardTitle>
          <CardDescription>
            {metrics.totalAccounts.toLocaleString()} total accounts tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{metrics.overallCompleteness}%</div>
                <div className="text-sm text-muted-foreground">Overall Completeness</div>
              </div>
              <div className="text-right">
                {metrics.overallCompleteness >= 80 ? (
                  <Badge className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Excellent
                  </Badge>
                ) : metrics.overallCompleteness >= 60 ? (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Good
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Needs Work
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={metrics.overallCompleteness} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Firmographic Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Firmographic Data Sync
          </CardTitle>
          <CardDescription>
            Synchronize data between accounts and leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncOpportunities && totalSyncOpportunities > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {syncOpportunities.leads_can_enrich.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Leads can be enriched from accounts</div>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold">
                  {syncOpportunities.accounts_can_enrich.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Accounts can be enriched from leads</div>
              </div>
            </div>
          )}

          {syncOpportunities?.pending_conflicts && syncOpportunities.pending_conflicts > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-amber-600 dark:text-amber-400">
                    {syncOpportunities.pending_conflicts} data conflicts detected
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Accounts and leads have different values
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleResolveConflicts}
                  disabled={isResolvingConflicts}
                >
                  {isResolvingConflicts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-1" />
                      AI Resolve
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {syncProgress.status === 'processing' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {syncProgress.message}
                </span>
              </div>
              <Progress value={50} className="h-1" />
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleBidirectionalSync}
              disabled={isSyncing || totalSyncOpportunities === 0}
              className="flex-1"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {syncProgress.phase === 'to_leads' ? 'Syncing leads...' : 'Syncing accounts...'}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync All ({totalSyncOpportunities.toLocaleString()})
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={handleDetectConflicts}
            >
              Detect Conflicts
            </Button>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="font-medium mb-1">How sync works</div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Aggregates lead data up to accounts (consensus from multiple leads)</li>
              <li>• Pushes account firmographics down to linked leads</li>
              <li>• Only fills empty fields - never overwrites existing data</li>
              <li>• AI resolves conflicts when account and lead values differ</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* HQ Address Enrichment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            HQ Address Enrichment
          </CardTitle>
          <CardDescription>
            Fetch company headquarters addresses from Apollo/PDL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {Math.round((metrics.withCountry / metrics.totalAccounts) * 100) || 0}%
              </div>
              <div className="text-xs text-muted-foreground">Accounts with country</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {metrics.totalAccounts - metrics.withCountry}
              </div>
              <div className="text-xs text-muted-foreground">Missing HQ addresses</div>
            </div>
          </div>

          <Button 
            onClick={handleEnrichHQAddresses}
            disabled={isEnrichingHQ || metrics.withCountry === metrics.totalAccounts}
            className="w-full"
          >
            {isEnrichingHQ ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching addresses...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Enrich HQ Addresses (up to 100)
              </>
            )}
          </Button>

          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="font-medium mb-1">What this enriches</div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Street address, city, state, postal code</li>
              <li>• Country for all missing records</li>
              <li>• Auto-syncs to linked leads</li>
              <li>• Uses Apollo API (or PDL fallback)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Industry Standardization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Industry Standardization
          </CardTitle>
          <CardDescription>
            Using ZoomInfo taxonomy for consistent classification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Standardized Accounts</span>
              <span className="font-medium">
                {metrics.standardizedIndustries.toLocaleString()} / {metrics.totalAccounts.toLocaleString()}
              </span>
            </div>
            <Progress value={standardizationPercent} className="h-2" />
          </div>

          <div className="space-y-2">
            {standardizationPercent < 100 && (
              <Button 
                onClick={handleStandardizeAll} 
                disabled={isStandardizing}
                className="w-full"
              >
                {isStandardizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Standardizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Standardize All Industries
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="font-medium mb-1">What does this do?</div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Maps existing industries to ZoomInfo taxonomy</li>
              <li>• Improves ICP scoring accuracy</li>
              <li>• Enables better filtering and segmentation</li>
              <li>• Makes data consistent across all sources</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Field-by-Field Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Field Completeness</CardTitle>
          <CardDescription>Breakdown by data field</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fieldCompleteness.map(field => {
              const percent = field.total > 0 ? Math.round((field.value / field.total) * 100) : 0;
              return (
                <div key={field.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{field.label}</span>
                    <span className="font-medium">{percent}%</span>
                  </div>
                  <Progress value={percent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {metrics.overallCompleteness < 80 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>How to improve data quality</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {totalSyncOpportunities > 0 && (
                <div className="flex gap-2">
                  <RefreshCw className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Run firmographic sync</div>
                    <div className="text-muted-foreground">
                      {totalSyncOpportunities.toLocaleString()} records can be enriched instantly
                    </div>
                  </div>
                </div>
              )}
              {metrics.withPrimaryIndustry < metrics.totalAccounts * 0.8 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Enrich industry data</div>
                    <div className="text-muted-foreground">
                      {(metrics.totalAccounts - metrics.withPrimaryIndustry).toLocaleString()} accounts missing industry classification
                    </div>
                  </div>
                </div>
              )}
              {metrics.withEmployeeCount < metrics.totalAccounts * 0.7 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Add company size data</div>
                    <div className="text-muted-foreground">
                      Employee counts improve ICP scoring by 15 points
                    </div>
                  </div>
                </div>
              )}
              {standardizationPercent < 90 && (
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Standardize industry taxonomy</div>
                    <div className="text-muted-foreground">
                      Use the "Standardize All Industries" button above
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
