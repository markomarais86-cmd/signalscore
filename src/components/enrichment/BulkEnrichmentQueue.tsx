import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, RefreshCw, DollarSign, ListTodo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface QueueJob {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export function BulkEnrichmentQueue() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  const loadJobs = async () => {
    if (!orgId) return;

    const { data, error } = await supabase
      .from('enrichment_queue')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading jobs:', error);
      return;
    }

    setJobs((data || []) as QueueJob[]);
    setLoading(false);
  };

  useEffect(() => {
    loadJobs();
    // Refresh every 10 seconds
    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, [orgId]);

  const triggerProcessing = async (jobId?: string) => {
    setProcessing(jobId || 'all');

    try {
      const { data, error } = await supabase.functions.invoke('enrich-unified', {
        body: jobId ? { job_id: jobId, record_type: 'account', records: [] } : { record_type: 'account', records: [] }
      });

      if (error) throw error;

      toast({
        title: "Queue processing triggered",
        description: data.message || `Processed ${data.processed_this_batch || 0} records`
      });

      loadJobs();
    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      processing: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
      cancelled: "bg-gray-100 text-gray-700"
    };
    return <Badge className={styles[status] || ""}>{status}</Badge>;
  };

  const getJobTypeIcon = (type: string) => {
    switch (type) {
      case 'lead': return '👤';
      case 'account': return '🏢';
      case 'discover': return '🔍';
      default: return '📋';
    }
  };

  const pendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Enrichment Queue
            </CardTitle>
            <CardDescription>
              Track and manage bulk enrichment jobs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadJobs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              onClick={() => triggerProcessing()}
              disabled={!!processing || pendingJobs.length === 0}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Process Queue
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">{pendingJobs.length}</div>
            <div className="text-sm text-muted-foreground">Pending Jobs</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">
              {jobs.reduce((sum, j) => sum + (j.processed_records || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Records Processed</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'completed').length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-2xl font-bold">
              ${jobs.reduce((sum, j) => sum + (j.actual_cost || 0), 0).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">Total Cost</div>
          </div>
        </div>

        {/* Active Jobs */}
        {pendingJobs.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Active Jobs
            </h4>
            {pendingJobs.map(job => (
              <div key={job.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{getJobTypeIcon(job.job_type)}</span>
                    <span className="font-medium capitalize">{job.job_type} Enrichment</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerProcessing(job.id)}
                    disabled={!!processing}
                  >
                    {processing === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Progress 
                  value={(job.processed_records / Math.max(job.total_records, 1)) * 100} 
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{job.processed_records} / {job.total_records} records</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {(job.actual_cost || 0).toFixed(3)} / ~{(job.estimated_cost || 0).toFixed(3)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Job History */}
        {jobs.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {getJobTypeIcon(job.job_type)} {job.job_type}
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-right">
                      {job.processed_records} / {job.total_records}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600">{job.successful_records}</span>
                      {job.failed_records > 0 && (
                        <span className="text-red-600 ml-1">/ {job.failed_records}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      ${(job.actual_cost || 0).toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : (
              "No enrichment jobs yet. Queue bulk enrichments from the Enrichment page."
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
