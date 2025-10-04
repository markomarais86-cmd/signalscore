import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Upload, Link2, Zap, CheckCircle2, AlertCircle, 
  Loader2, TrendingUp, Clock, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PipelineStage {
  name: string;
  status: 'idle' | 'processing' | 'complete' | 'error';
  progress: number;
  stats?: {
    total?: number;
    processed?: number;
    successful?: number;
    failed?: number;
  };
  message?: string;
}

interface ProcessingJob {
  id: string;
  type: string;
  started_at: string;
  status: string;
  stats: string;
}

export function DataProcessingPipeline() {
  const { userProfile } = useAuth();
  const [stages, setStages] = useState<{
    upload: PipelineStage;
    match: PipelineStage;
    score: PipelineStage;
  }>({
    upload: { name: 'Data Upload', status: 'idle', progress: 0 },
    match: { name: 'Lead-Account Matching', status: 'idle', progress: 0 },
    score: { name: 'ICP Scoring', status: 'idle', progress: 0 }
  });
  const [history, setHistory] = useState<ProcessingJob[]>([]);

  // Poll for pipeline status every 3 seconds
  useEffect(() => {
    if (!userProfile?.org_id) return;

    const checkStatus = async () => {
      try {
        // Check lead counts
        const { data: leads, count: totalLeads } = await supabase
          .from('Leads')
          .select('account_external_id', { count: 'exact' })
          .eq('org_id', userProfile.org_id);

        const unmatchedCount = leads?.filter(l => !l.account_external_id).length || 0;
        const matchedCount = (totalLeads || 0) - unmatchedCount;

        // Check active scoring job
        const { data: scoringJobs } = await supabase
          .from('bulk_scoring_jobs')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1);

        const activeJob = scoringJobs?.[0];

        // Check recent accounts
        const { count: accountCount } = await supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id);

        // Check scored accounts
        const { count: scoredCount } = await supabase
          .from('scores')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id);

        // Update stages
        setStages({
          upload: {
            name: 'Data Upload',
            status: totalLeads ? 'complete' : 'idle',
            progress: totalLeads ? 100 : 0,
            stats: { total: totalLeads || 0 },
            message: totalLeads ? `${totalLeads} leads in database` : 'No leads uploaded yet'
          },
          match: {
            name: 'Lead-Account Matching',
            status: unmatchedCount > 0 ? 'processing' : totalLeads ? 'complete' : 'idle',
            progress: totalLeads ? ((matchedCount / totalLeads) * 100) : 0,
            stats: { 
              total: totalLeads || 0,
              processed: matchedCount,
              successful: accountCount || 0
            },
            message: unmatchedCount > 0 
              ? `${unmatchedCount} leads pending match`
              : matchedCount > 0 
                ? `All ${matchedCount} leads matched to accounts`
                : 'Waiting for leads'
          },
          score: {
            name: 'ICP Scoring',
            status: activeJob 
              ? 'processing' 
              : (accountCount && accountCount > 0)
                ? (scoredCount && scoredCount > 0 ? 'complete' : 'idle')
                : 'idle',
            progress: activeJob 
              ? ((activeJob.processed_accounts / activeJob.total_accounts) * 100)
              : scoredCount && accountCount 
                ? ((scoredCount / accountCount) * 100)
                : 0,
            stats: activeJob ? {
              total: activeJob.total_accounts,
              processed: activeJob.processed_accounts,
              successful: activeJob.successful_scores,
              failed: activeJob.failed_scores
            } : {
              total: accountCount || 0,
              processed: scoredCount || 0
            },
            message: activeJob
              ? `Processing chunk ${activeJob.current_chunk + 1}/${activeJob.total_chunks}`
              : scoredCount && accountCount
                ? `${scoredCount} of ${accountCount} accounts scored`
                : 'Waiting for accounts'
          }
        });

        // Load recent history
        const { data: recentJobs } = await supabase
          .from('bulk_scoring_jobs')
          .select('id, status, started_at, total_accounts, successful_scores, failed_scores')
          .eq('org_id', userProfile.org_id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(5);

        if (recentJobs) {
          setHistory(recentJobs.map(job => ({
            id: job.id,
            type: 'Bulk Scoring',
            started_at: job.started_at,
            status: job.status,
            stats: `${job.successful_scores}/${job.total_accounts} scored`
          })));
        }
      } catch (error) {
        console.error('Error checking pipeline status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [userProfile?.org_id]);

  const getStageIcon = (status: PipelineStage['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStageColor = (status: PipelineStage['status']) => {
    switch (status) {
      case 'processing':
        return 'border-primary bg-primary/5';
      case 'complete':
        return 'border-green-500 bg-green-500/5';
      case 'error':
        return 'border-destructive bg-destructive/5';
      default:
        return 'border-muted bg-muted/5';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Data Processing Pipeline
        </CardTitle>
        <CardDescription>
          Real-time monitoring of upload → match → score workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Stage */}
        <div className={cn("p-4 border rounded-lg transition-colors", getStageColor(stages.upload.status))}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">{stages.upload.name}</h3>
                <p className="text-sm text-muted-foreground">{stages.upload.message}</p>
              </div>
            </div>
            {getStageIcon(stages.upload.status)}
          </div>
          {stages.upload.status !== 'idle' && (
            <div className="mt-3 space-y-2">
              <Progress value={stages.upload.progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stages.upload.stats?.total?.toLocaleString() || 0} leads</span>
                <span>{Math.round(stages.upload.progress)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Match Stage */}
        <div className={cn("p-4 border rounded-lg transition-colors", getStageColor(stages.match.status))}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">{stages.match.name}</h3>
                <p className="text-sm text-muted-foreground">{stages.match.message}</p>
              </div>
            </div>
            {getStageIcon(stages.match.status)}
          </div>
          {stages.match.status !== 'idle' && (
            <div className="mt-3 space-y-2">
              <Progress value={stages.match.progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {stages.match.stats?.processed?.toLocaleString() || 0} / {stages.match.stats?.total?.toLocaleString() || 0} matched
                </span>
                <span>{Math.round(stages.match.progress)}%</span>
              </div>
              {stages.match.stats?.successful && (
                <Badge variant="secondary" className="text-xs">
                  {stages.match.stats.successful} accounts created
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Score Stage */}
        <div className={cn("p-4 border rounded-lg transition-colors", getStageColor(stages.score.status))}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">{stages.score.name}</h3>
                <p className="text-sm text-muted-foreground">{stages.score.message}</p>
              </div>
            </div>
            {getStageIcon(stages.score.status)}
          </div>
          {stages.score.status !== 'idle' && (
            <div className="mt-3 space-y-2">
              <Progress value={stages.score.progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {stages.score.stats?.processed?.toLocaleString() || 0} / {stages.score.stats?.total?.toLocaleString() || 0} scored
                </span>
                <span>{Math.round(stages.score.progress)}%</span>
              </div>
              {stages.score.stats?.failed !== undefined && stages.score.stats.failed > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stages.score.stats.failed} failures
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Info Alert */}
        {stages.upload.status === 'idle' && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Upload leads using the CSV upload section above. Matching and scoring will happen automatically.
            </AlertDescription>
          </Alert>
        )}

        {/* Processing History */}
        {history.length > 0 && (
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="history">
              <AccordionTrigger className="text-sm font-semibold">
                Processing History ({history.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {history.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div>
                        <p className="font-medium">{job.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.started_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{job.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{job.stats}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
