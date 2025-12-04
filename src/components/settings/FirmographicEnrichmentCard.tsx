import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Users, Clock, CheckCircle2, XCircle, Loader2, Zap, AlertCircle, Database } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface DataCompleteness {
  employeeCountComplete: number;
  employeeCountTotal: number;
  employeeCountPercent: number;
  revenueRangeComplete: number;
  revenueRangeTotal: number;
  revenueRangePercent: number;
  accountsWithDomain: number;
}

interface EnrichmentJob {
  id: string;
  status: string;
  total_records: number;
  processed_records: number;
  enriched_records: number;
  failed_records: number;
  started_at: string;
  completed_at: string | null;
  batch_size?: number;
  provider?: string;
}

export function FirmographicEnrichmentCard() {
  const [completeness, setCompleteness] = useState<DataCompleteness | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [currentJob, setCurrentJob] = useState<EnrichmentJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<EnrichmentJob[]>([]);
  const [batchSize, setBatchSize] = useState<string>("500");
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadCompleteness();
    loadRecentJobs();
  }, [userProfile]);

  // Poll for job progress when enriching
  useEffect(() => {
    if (!enriching || !currentJob) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('id', currentJob.id)
        .single();

      if (!error && data) {
        setCurrentJob(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setEnriching(false);
          clearInterval(interval);
          loadCompleteness();
          loadRecentJobs();
          
          if (data.status === 'completed') {
            toast({
              title: "Enrichment Complete",
              description: `Enriched ${data.enriched_records} of ${data.total_records} accounts`,
            });
          } else {
            toast({
              title: "Enrichment Failed",
              description: data.error_message || "An error occurred during enrichment",
              variant: "destructive"
            });
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enriching, currentJob]);

  const loadCompleteness = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('employee_count, revenue_range, domain')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      if (accounts) {
        const total = accounts.length;
        const employeeCountComplete = accounts.filter(a => a.employee_count !== null).length;
        const revenueRangeComplete = accounts.filter(a => a.revenue_range !== null).length;
        const accountsWithDomain = accounts.filter(a => a.domain !== null).length;

        setCompleteness({
          employeeCountComplete,
          employeeCountTotal: total,
          employeeCountPercent: total > 0 ? Math.round((employeeCountComplete / total) * 100) : 0,
          revenueRangeComplete,
          revenueRangeTotal: total,
          revenueRangePercent: total > 0 ? Math.round((revenueRangeComplete / total) * 100) : 0,
          accountsWithDomain,
        });
      }
    } catch (error) {
      console.error('Error loading completeness:', error);
    }
  };

  const loadRecentJobs = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('job_type', 'accounts')
        .order('started_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentJobs(data || []);
    } catch (error) {
      console.error('Error loading recent jobs:', error);
    }
  };

  const startEnrichment = async (provider: 'smart' | 'apollo' | 'pdl' | 'ai') => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not found",
        variant: "destructive"
      });
      return;
    }

    const selectedBatchSize = batchSize === 'all' 
      ? (completeness?.employeeCountTotal || 1000) - (completeness?.employeeCountComplete || 0)
      : parseInt(batchSize);

    setLoading(true);

    try {
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          job_type: 'accounts',
          provider: provider === 'smart' ? 'smart_waterfall' : provider,
          status: 'pending',
          total_records: selectedBatchSize,
          batch_size: selectedBatchSize,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0
        })
        .select()
        .single();

      if (jobError) throw jobError;

      setCurrentJob(job);
      setEnriching(true);

      // All providers now use smart-enrich with waterfall
      const { error: funcError } = await supabase.functions.invoke('smart-enrich', {
        body: { 
          jobId: job.id,
          batchSize: selectedBatchSize
        }
      });

      if (funcError) {
        console.error('Function error:', funcError);
        toast({
          title: "Error",
          description: "Failed to start enrichment. Check edge function logs.",
          variant: "destructive"
        });
        setEnriching(false);
      }
    } catch (error: any) {
      console.error('Error starting enrichment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment",
        variant: "destructive"
      });
      setEnriching(false);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-executive-green text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500 text-white"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'smart_waterfall': return 'Smart';
      case 'apollo': return 'Apollo';
      case 'pdl': return 'PDL';
      case 'ai': return 'AI';
      default: return provider;
    }
  };

  if (!completeness) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const missingEmployeeCount = completeness.employeeCountTotal - completeness.employeeCountComplete;
  const missingRevenueRange = completeness.revenueRangeTotal - completeness.revenueRangeComplete;
  const enrichableAccounts = Math.min(missingEmployeeCount, completeness.accountsWithDomain);
  const canEnrich = enrichableAccounts > 0;

  // Estimate time based on batch size (roughly 2 accounts/second with API calls)
  const estimatedMinutes = Math.ceil((parseInt(batchSize) || enrichableAccounts) / 120);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-primary" />
              Employee Count Enrichment
            </CardTitle>
            <CardDescription>
              Fill missing firmographic data using Apollo, PDL, and AI
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Missing Data Alert */}
        {canEnrich && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                {missingEmployeeCount.toLocaleString()} accounts missing employee count
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {enrichableAccounts.toLocaleString()} have domains and can be enriched
              </p>
            </div>
          </div>
        )}

        {/* Data Completeness Progress */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1">
                <Users className="h-3 w-3" />
                Employee Count
              </span>
              <span className={`text-xs font-medium ${completeness.employeeCountPercent < 50 ? 'text-destructive' : completeness.employeeCountPercent < 80 ? 'text-amber-600' : 'text-executive-green'}`}>
                {completeness.employeeCountPercent}%
              </span>
            </div>
            <Progress 
              value={completeness.employeeCountPercent} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {completeness.employeeCountComplete.toLocaleString()} / {completeness.employeeCountTotal.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Revenue Range
              </span>
              <span className={`text-xs font-medium ${completeness.revenueRangePercent < 50 ? 'text-destructive' : completeness.revenueRangePercent < 80 ? 'text-amber-600' : 'text-executive-green'}`}>
                {completeness.revenueRangePercent}%
              </span>
            </div>
            <Progress 
              value={completeness.revenueRangePercent} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {completeness.revenueRangeComplete.toLocaleString()} / {completeness.revenueRangeTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Batch Size Selector & Actions */}
        {!enriching && canEnrich && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block">Batch Size</label>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 accounts (~1 min)</SelectItem>
                    <SelectItem value="500">500 accounts (~5 min)</SelectItem>
                    <SelectItem value="1000">1,000 accounts (~10 min)</SelectItem>
                    <SelectItem value="2500">2,500 accounts (~25 min)</SelectItem>
                    <SelectItem value="all">All {enrichableAccounts.toLocaleString()} accounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={() => startEnrichment('smart')} 
              disabled={loading}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Start Smart Enrichment
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              Uses Apollo → PDL → AI waterfall for best coverage
            </p>
          </div>
        )}

        {/* Enrichment Progress */}
        {enriching && currentJob && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">Enriching accounts...</span>
              </div>
              {getStatusBadge(currentJob.status)}
            </div>
            
            <Progress 
              value={currentJob.total_records > 0 
                ? (currentJob.processed_records / currentJob.total_records) * 100 
                : 0
              } 
              className="h-2"
            />

            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Enriched</p>
                <p className="text-lg font-bold text-executive-green">{currentJob.enriched_records}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-lg font-bold text-destructive">{currentJob.failed_records}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-lg font-bold">
                  {currentJob.processed_records} / {currentJob.total_records}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Completion State */}
        {!canEnrich && (
          <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg bg-muted/30">
            <CheckCircle2 className="h-5 w-5 text-executive-green" />
            <p className="font-medium">All enrichable accounts have employee data!</p>
          </div>
        )}

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Recent Jobs</h4>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {getProviderLabel(job.provider || 'smart')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.started_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {job.enriched_records}/{job.total_records}
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
