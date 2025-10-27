import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, TrendingDown, Minus, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface BulkScoringProps {
  onComplete?: () => void;
}

interface ScoringJob {
  id: string;
  total_accounts: number;
  processed_accounts: number;
  successful_scores: number;
  failed_scores: number;
  current_chunk: number;
  total_chunks: number;
  status: string;
}

export function BulkScoring({ onComplete }: BulkScoringProps) {
  const { userProfile } = useAuth();
  const [isScoring, setIsScoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJob, setCurrentJob] = useState<ScoringJob | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    avgScore: number;
    failures: number;
    scoredAccounts: number;
    unscoredAccounts: number;
    scoringCoverage: number;
  } | null>(null);

  // Use refs for synchronous locking (prevents race conditions)
  const isInvokingChunk = useRef(false);
  const lastTriggeredChunk = useRef(-1);

  // Real-time subscription to job status
  useEffect(() => {
    if (!userProfile?.org_id || !isScoring) return;

    console.log('[Realtime] Subscribing to bulk_scoring_jobs changes');

    const channel = supabase
      .channel('bulk-scoring-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_scoring_jobs',
          filter: `org_id=eq.${userProfile.org_id}`
        },
        async (payload) => {
          const job = payload.new as ScoringJob;
          
          console.log('[Realtime] Update:', {
            status: job?.status,
            current_chunk: job?.current_chunk,
            processed: job?.processed_accounts,
            total: job?.total_accounts,
            isInvoking: isInvokingChunk.current,
            lastTriggered: lastTriggeredChunk.current
          });
          
          if (!job || !['pending', 'processing', 'completed'].includes(job.status)) {
            console.log('[Realtime] Ignoring job with status:', job?.status);
            return;
          }

          // Update UI with latest job status
          const safeProcessed = Math.min(job.processed_accounts, job.total_accounts);
          const progressPercent = job.total_accounts > 0 
            ? Math.min(100, (safeProcessed / job.total_accounts) * 100)
            : 0;
          
          setCurrentJob(job);
          setProgress(progressPercent);

          // Use current_chunk from database (already incremented by edge function)
          const nextChunkIndex = job.current_chunk;
          const isLastChunk = nextChunkIndex >= job.total_chunks;
          
          console.log('[Realtime] Chunk decision:', {
            nextChunkIndex,
            isLastChunk,
            shouldTrigger: !isLastChunk && job.status === "processing" && !isInvokingChunk.current && nextChunkIndex > lastTriggeredChunk.current
          });
          
          if (
            !isLastChunk && 
            job.status === "processing" && 
            !isInvokingChunk.current && 
            nextChunkIndex > lastTriggeredChunk.current
          ) {
            console.log(`[Trigger] Starting chunk ${nextChunkIndex} of ${job.total_chunks - 1}`);
            
            isInvokingChunk.current = true;
            lastTriggeredChunk.current = nextChunkIndex;
            
            try {
              const result = await supabase.functions.invoke("bulk-score-accounts", {
                body: {
                  org_id: userProfile.org_id,
                  job_id: job.id,
                  chunk_index: nextChunkIndex,
                  chunk_size: 5000,
                },
              });
              console.log('[Trigger] Result:', result);
            } catch (error) {
              console.error(`[Error] Chunk ${nextChunkIndex}:`, error);
              isInvokingChunk.current = false;
            } finally {
              setTimeout(() => { isInvokingChunk.current = false; }, 1000);
            }
          }

          // Handle completion
          if (job.status === "completed") {
            console.log('[Realtime] Job completed');
            setIsScoring(false);
            setProgress(100);

            // Fetch final statistics
            const { count: totalAccounts } = await supabase
              .from("accounts")
              .select("*", { count: "exact", head: true })
              .eq("org_id", userProfile.org_id);

            const { data: scores } = await supabase
              .from("scores")
              .select("overall")
              .eq("org_id", userProfile.org_id);

            const scoredCount = scores?.length || 0;
            const unscoredCount = (totalAccounts || 0) - scoredCount;
            const coveragePercent = totalAccounts ? Math.round((scoredCount / totalAccounts) * 100) : 0;

            const avgScore = scoredCount > 0
              ? Math.round(scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scoredCount)
              : 0;

            setStats({
              total: totalAccounts || 0,
              completed: job.successful_scores,
              avgScore,
              failures: job.failed_scores,
              scoredAccounts: scoredCount,
              unscoredAccounts: unscoredCount,
              scoringCoverage: coveragePercent,
            });

            // Record data quality snapshot
            await supabase.rpc('record_data_quality_snapshot', {
              org_id_param: userProfile.org_id
            });

            toast.success(`Successfully scored ${scoredCount.toLocaleString()} accounts!`);
            onComplete?.();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[Realtime] Unsubscribing from bulk_scoring_jobs');
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id, isScoring, onComplete]);

  // Timeout recovery: Release lock if chunk is stuck
  useEffect(() => {
    if (!isScoring || !currentJob) return;
    
    const timeoutId = setTimeout(() => {
      if (isInvokingChunk.current) {
        console.log('[Timeout] Chunk stuck for 15s, releasing lock');
        isInvokingChunk.current = false;
      }
    }, 15000);
    
    return () => clearTimeout(timeoutId);
  }, [currentJob?.processed_accounts, isScoring]);

  const runBulkScoring = async () => {
    if (!userProfile?.org_id) {
      toast.error("Organization not found");
      return;
    }

    try {
      setIsScoring(true);
      setProgress(0);
      setStats(null);
      setCurrentJob(null);
      
      // Reset refs
      isInvokingChunk.current = false;
      lastTriggeredChunk.current = -1;

      // Check for existing active job
      const { data: existingJobs } = await supabase
        .from("bulk_scoring_jobs")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        toast.info("Resuming existing scoring job...");
        return; // Polling will handle the rest
      }

      // Validate prerequisites
      const { count: accountCount } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id);

      const { data: icps } = await supabase
        .from("icp_profiles")
        .select("id")
        .eq("org_id", userProfile.org_id)
        .eq("status", "active");

      if (!accountCount || !icps?.length) {
        toast.error("No accounts or active ICP profiles found");
        setIsScoring(false);
        return;
      }

      toast.info(`Starting bulk scoring for ${accountCount.toLocaleString()} accounts...`);

      // Invoke edge function once - it will handle all chunking server-side
      const { error } = await supabase.functions.invoke("bulk-score-accounts", {
        body: {
          org_id: userProfile.org_id,
          chunk_index: 0,
          chunk_size: 5000,
        },
      });

      if (error) {
        throw error;
      }

      // Polling will now track progress automatically
    } catch (error) {
      console.error("Bulk scoring error:", error);
      toast.error("Failed to start bulk scoring");
      setIsScoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Bulk Scoring Engine
        </CardTitle>
        <CardDescription>
          Score all accounts against your active ICP profiles using chunked processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScoring && !stats && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <strong>Manual Re-scoring:</strong> This will re-calculate scores for all existing accounts.
              <div className="mt-2 text-xs space-y-1">
                <p>✅ New accounts are scored automatically upon creation</p>
                <p>✅ Accounts are re-scored when enriched</p>
                <p>ℹ️ Use this button to re-score historical data or after changing ICP criteria</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isScoring && currentJob && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Processing chunk {currentJob.current_chunk + 1} of {currentJob.total_chunks}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium">Progress</p>
                <p>{Math.min(currentJob.processed_accounts, currentJob.total_accounts).toLocaleString()} / {currentJob.total_accounts.toLocaleString()} accounts</p>
              </div>
              <div>
                <p className="font-medium">Success Rate</p>
                <p>
                  {currentJob.successful_scores > 0 
                    ? `${((currentJob.successful_scores / (currentJob.successful_scores + currentJob.failed_scores)) * 100).toFixed(1)}%`
                    : "Calculating..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {stats && (
          <div className="space-y-4">
            <Alert className="bg-primary/10 border-primary">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Scoring Complete!</strong> {stats.scoredAccounts.toLocaleString()} of {stats.total.toLocaleString()} accounts now have scores ({stats.scoringCoverage}% coverage).
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Accounts</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.scoredAccounts.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Scored ({stats.scoringCoverage}%)</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{stats.avgScore}</div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{stats.unscoredAccounts.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Unscored</div>
              </div>
            </div>

            {stats.avgScore >= 75 && (
              <Badge className="w-full justify-center py-2" variant="default">
                <TrendingUp className="mr-2 h-4 w-4" />
                Excellent ICP Match Quality
              </Badge>
            )}
            {stats.avgScore >= 50 && stats.avgScore < 75 && (
              <Badge className="w-full justify-center py-2" variant="secondary">
                <Minus className="mr-2 h-4 w-4" />
                Good ICP Match Quality
              </Badge>
            )}
            {stats.avgScore < 50 && (
              <Badge className="w-full justify-center py-2" variant="outline">
                <TrendingDown className="mr-2 h-4 w-4" />
                Consider Refining ICP Criteria
              </Badge>
            )}
          </div>
        )}

        <Button
          onClick={runBulkScoring}
          disabled={isScoring}
          className="w-full"
          size="lg"
        >
          {isScoring ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Scoring in Progress...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Run Bulk Scoring
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
