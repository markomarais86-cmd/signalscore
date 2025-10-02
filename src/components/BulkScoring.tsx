import { useState, useEffect } from "react";
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

  // Poll for active job status
  useEffect(() => {
    if (!userProfile?.org_id || !isScoring) return;

    const pollInterval = setInterval(async () => {
      const { data: jobs } = await supabase
        .from("bulk_scoring_jobs")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1);

      if (jobs && jobs.length > 0) {
        const job = jobs[0] as ScoringJob;
        setCurrentJob(job);
        const progressPercent = (job.processed_accounts / job.total_accounts) * 100;
        setProgress(progressPercent);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [userProfile?.org_id, isScoring]);

  const processNextChunk = async (jobId: string, chunkIndex: number) => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase.functions.invoke("bulk-score-accounts", {
        body: {
          org_id: userProfile.org_id,
          job_id: jobId || undefined, // Pass undefined if empty string
          chunk_index: chunkIndex,
          chunk_size: 2000,
        },
      });

      if (error) throw error;

      // Capture the job_id from the first chunk response
      const actualJobId = data.job_id || jobId;

      // If not the last chunk, continue processing with the captured job_id
      if (!data.is_last_chunk) {
        setTimeout(() => processNextChunk(actualJobId, chunkIndex + 1), 1000);
      } else {
        // Job complete
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
          total: data.total_accounts,
          completed: data.total_processed,
          avgScore,
          failures: data.failed_scores,
        });

        toast.success(`Successfully scored ${data.total_processed} accounts!`);
        onComplete?.();
      }
    } catch (error) {
      console.error("Chunk processing error:", error);
      toast.error(`Failed to process chunk ${chunkIndex + 1}`);
      setIsScoring(false);
    }
  };

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

      // Check for existing active job
      const { data: existingJobs } = await supabase
        .from("bulk_scoring_jobs")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        const job = existingJobs[0] as ScoringJob;
        setCurrentJob(job);
        toast.info("Resuming existing scoring job...");
        processNextChunk(job.id, job.current_chunk);
        return;
      }

      // Get total accounts and ICPs
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

      toast.info(`Starting to score ${accountCount.toLocaleString()} accounts...`);

      // Start first chunk
      processNextChunk("", 0);
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
