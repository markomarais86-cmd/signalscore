import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EnrichmentJob {
  id: string;
  provider: string;
  status: string;
  accounts_enriched: number;
  fields_enriched: number;
  failed_records: number;
  total_records: number;
  processed_records: number;
  completed_at: string | null;
  started_at: string | null;
}

const providerLabels: Record<string, string> = {
  "launch_pulse": "Launch Pulse",
  "ai": "AI Research",
  "apollo": "Apollo",
  "pdl": "People Data Labs",
  "combined": "Multi-Source",
  "hybrid": "Hybrid",
};

export function RecentEnrichmentActivity() {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadJobs();
    }
  }, [userProfile?.org_id]);

  const loadJobs = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from("enrichment_jobs")
        .select("id, provider, status, accounts_enriched, fields_enriched, failed_records, total_records, processed_records, completed_at, started_at")
        .eq("org_id", userProfile.org_id)
        .in("status", ["completed", "completed_with_errors", "failed", "processing", "pending"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setJobs((data || []) as EnrichmentJob[]);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "completed_with_errors":
        return <CheckCircle2 className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "processing":
      case "pending":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case "completed_with_errors":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Partial</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Running</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return null; // Silent loading
  }

  if (jobs.length === 0) {
    return null; // Don't show if no history
  }

  const displayedJobs = expanded ? jobs : jobs.slice(0, 3);
  const hasMore = jobs.length > 3;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Last {jobs.length} enrichment jobs
              </CardDescription>
            </div>
            {hasMore && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  {expanded ? (
                    <>
                      Show Less
                      <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      View All
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {displayedJobs.slice(0, 3).map((job) => (
              <JobRow key={job.id} job={job} getStatusIcon={getStatusIcon} getStatusBadge={getStatusBadge} />
            ))}
            
            <CollapsibleContent className="space-y-2">
              {displayedJobs.slice(3).map((job) => (
                <JobRow key={job.id} job={job} getStatusIcon={getStatusIcon} getStatusBadge={getStatusBadge} />
              ))}
            </CollapsibleContent>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

function JobRow({ 
  job, 
  getStatusIcon, 
  getStatusBadge 
}: { 
  job: EnrichmentJob; 
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const timeAgo = job.completed_at 
    ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
    : job.started_at 
      ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true })
      : "Unknown";

  const alreadyComplete = Math.max(0, (job.processed_records || 0) - (job.accounts_enriched || 0) - (job.failed_records || 0));

  // Build a human-friendly summary
  const parts: string[] = [];
  if (job.accounts_enriched > 0) parts.push(`${job.accounts_enriched} new`);
  if (alreadyComplete > 0) parts.push(`${alreadyComplete} already OK`);
  if (job.failed_records > 0) parts.push(`${job.failed_records} not found`);
  const summary = parts.length > 0 ? parts.join(' • ') : `${job.processed_records || 0} processed`;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        {getStatusIcon(job.status)}
        <div>
          <p className="text-sm font-medium">
            {providerLabels[job.provider] || job.provider}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary} • {timeAgo}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {job.status === "completed" && alreadyComplete > 0 && job.accounts_enriched === 0 && (
          <span className="text-xs text-blue-600">Up to date</span>
        )}
        {getStatusBadge(job.status)}
      </div>
    </div>
  );
}
