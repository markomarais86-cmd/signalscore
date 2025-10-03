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
  } | null>(null);

  // Use refs for synchronous locking (prevents race conditions)
  const isInvokingChunk = useRef(false);
  const lastTriggeredChunk = useRef(-1);

  // Poll for job status and trigger next chunks with proper locking
  useEffect(() => {
    if (!userProfile?.org_id || !isScoring) return;

    const pollInterval = setInterval(async () => {
      const { data: jobs } = await supabase
        .from("bulk_scoring_jobs")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (jobs && jobs.length > 0) {
        const job = jobs[0] as ScoringJob;
        const progressPercent = job.total_accounts > 0 
          ? (job.processed_accounts / job.total_accounts) * 100 
          : 0;
        
        setCurrentJob(job);
        setProgress(progressPercent);

        // Only trigger next chunk if:
        // 1. Not the last chunk
        // 2. Job is still processing
        // 3. Not already invoking a chunk (synchronous lock)
        // 4. Current chunk is complete (processed_accounts is on a chunk boundary)
        // 5. Haven't already triggered this chunk
        const nextChunk = job.current_chunk;
        const isLastChunk = nextChunk >= job.total_chunks;
        const chunkSize = 2000;
        const isChunkComplete = job.processed_accounts > 0 && job.processed_accounts % chunkSize === 0;
        const expectedChunk = Math.floor(job.processed_accounts / chunkSize);
        
        if (
          !isLastChunk && 
          job.status === "processing" && 
          !isInvokingChunk.current && 
          isChunkComplete &&
          nextChunk === expectedChunk &&
          nextChunk !== lastTriggeredChunk.current
        ) {
          console.log(`[Trigger] Chunk ${nextChunk + 1} of ${job.total_chunks} (processed: ${job.processed_accounts})`);
          
          // Set locks immediately (synchronous)
          isInvokingChunk.current = true;
          lastTriggeredChunk.current = nextChunk;
          
          try {
            await supabase.functions.invoke("bulk-score-accounts", {
              body: {
                org_id: userProfile.org_id,
                job_id: job.id,
                chunk_index: nextChunk,
                chunk_size: chunkSize,
              },
            });
          } catch (error) {
            console.error(`[Error] Failed to trigger chunk ${nextChunk + 1}:`, error);
          } finally {
            // Release lock after invocation completes
            isInvokingChunk.current = false;
          }
        }

        // Check if job completed
        if (job.status === "completed") {
          setIsScoring(false);
          setProgress(100);

          // Fetch final statistics
          const { data: scores } = await supabase
            .from("scores")
            .select("overall")
            .eq("org_id", userProfile.org_id);

          const avgScore = scores?.length 
            ? Math.round(scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scores.length)
            : 0;

          setStats({
            total: job.total_accounts,
            completed: job.successful_scores,
            avgScore,
            failures: job.failed_scores,
          });

          // Record data quality snapshot after scoring completes
          await supabase.rpc('record_data_quality_snapshot', {
            org_id_param: userProfile.org_id
          }).then(({ error: snapshotError }) => {
            if (snapshotError) {
              console.error('Failed to record data quality snapshot:', snapshotError);
            } else {
              console.log('Data quality snapshot recorded successfully');
            }
          });

          toast.success(`Successfully scored ${job.successful_scores.toLocaleString()} accounts!`);
          onComplete?.();
        }
      }
    }, 3000); // Increased to 3 seconds to reduce race condition window

    return () => clearInterval(pollInterval);
  }, [userProfile?.org_id, isScoring, onComplete]);

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
          chunk_size: 2000,
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
              This will calculate ICP match scores for all your accounts using a reliable chunked processing system. The process evaluates:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Industry alignment</li>
                <li>Company size fit</li>
                <li>Revenue range match</li>
                <li>Geographic targeting</li>
              </ul>
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
                <p>{currentJob.processed_accounts.toLocaleString()} / {currentJob.total_accounts.toLocaleString()} accounts</p>
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
                <strong>Scoring Complete!</strong> Successfully scored {stats.completed.toLocaleString()} accounts.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Accounts</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.completed.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{stats.avgScore}</div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.failures}</div>
                <div className="text-sm text-muted-foreground">Failures</div>
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
