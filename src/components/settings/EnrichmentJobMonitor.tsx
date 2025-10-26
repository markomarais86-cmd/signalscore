import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface EnrichmentJob {
  id: string;
  provider: string;
  job_type: string;
  status: string;
  total_records: number;
  processed_records: number;
  enriched_records: number;
  failed_records: number;
  started_at: string;
  completed_at?: string;
  credits_used?: number;
  credits_remaining?: number;
}

interface OrgCredits {
  total: number;
  used: number;
  remaining: number;
}

export function EnrichmentJobMonitor() {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgCredits, setOrgCredits] = useState<OrgCredits | null>(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    loadJobs();
    loadCredits();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('enrichment-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_jobs'
        },
        () => {
          loadJobs();
          loadCredits();
        }
      )
      .subscribe();

    // Poll every 5 seconds for active jobs
    const interval = setInterval(() => {
      loadJobs();
      loadCredits();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userProfile?.org_id]);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("enrichment_jobs")
        .select("*")
        .in("status", ["pending", "processing"])
        .order("started_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCredits = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_org_enrichment_credits', { org_uuid: userProfile.org_id });

      if (!error && data && data.length > 0) {
        setOrgCredits(data[0]);
      }
    } catch (error) {
      console.error("Error loading credits:", error);
    }
  };

  const calculateETR = (job: EnrichmentJob): string => {
    if (job.processed_records === 0 || job.status !== 'processing') {
      return 'Calculating...';
    }
    
    const elapsed = Date.now() - new Date(job.started_at).getTime();
    const rate = job.processed_records / (elapsed / 1000); // records per second
    const remaining = job.total_records - job.processed_records;
    const etrSeconds = remaining / rate;
    
    if (etrSeconds < 60) return `~${Math.round(etrSeconds)} seconds`;
    if (etrSeconds < 3600) return `~${Math.round(etrSeconds / 60)} minutes`;
    return `~${(etrSeconds / 3600).toFixed(1)} hours`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getProgress = (job: EnrichmentJob) => {
    if (job.total_records === 0) return 0;
    return (job.processed_records / job.total_records) * 100;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Jobs
          </CardTitle>
          <CardDescription>
            No enrichment jobs currently running
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Enrichment Jobs
            </CardTitle>
            <CardDescription>
              Real-time monitoring of enrichment progress
            </CardDescription>
          </div>
          {orgCredits && (
            <div className="text-right">
              <div className="text-sm font-medium">
                {orgCredits.remaining.toLocaleString()} credits
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round((orgCredits.remaining / orgCredits.total) * 100)}% remaining
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(job.status)}
                <span className="font-medium capitalize">
                  {job.provider.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className="text-xs">
                  {job.job_type}
                </Badge>
              </div>
              <Badge variant={job.status === "processing" ? "default" : "secondary"}>
                {job.status}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <div className="text-right">
                  <span className="font-medium">
                    {job.processed_records} / {job.total_records}
                  </span>
                  {job.status === 'processing' && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {calculateETR(job)}
                    </span>
                  )}
                </div>
              </div>
              <Progress value={getProgress(job)} className="h-2" />
              {job.credits_used !== undefined && job.credits_used > 0 && (
                <div className="text-xs text-muted-foreground">
                  Credits used: {job.credits_used.toLocaleString()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Enriched</p>
                <p className="font-medium text-green-600">{job.enriched_records}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed</p>
                <p className="font-medium text-destructive">{job.failed_records}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Success Rate</p>
                <p className="font-medium">
                  {job.processed_records > 0
                    ? Math.round((job.enriched_records / job.processed_records) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Started: {new Date(job.started_at).toLocaleString()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
