import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}

export function EnrichmentJobMonitor() {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
    
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
        }
      )
      .subscribe();

    // Poll every 5 seconds for active jobs
    const interval = setInterval(() => {
      loadJobs();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

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
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Active Enrichment Jobs
        </CardTitle>
        <CardDescription>
          Real-time monitoring of enrichment progress
        </CardDescription>
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
                <span className="font-medium">
                  {job.processed_records} / {job.total_records}
                </span>
              </div>
              <Progress value={getProgress(job)} className="h-2" />
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
