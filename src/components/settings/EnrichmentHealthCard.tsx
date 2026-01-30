import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, TrendingUp, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export function EnrichmentHealthCard() {
  const { userProfile } = useAuth();

  const { data: healthData, isLoading } = useQuery({
    queryKey: ['enrichment-health', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error('No org ID');

      // Get total enriched leads
      const { count: enrichedCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .not('enriched_from', 'is', null);

      // Get last 7 days enrichment jobs
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentJobs } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Calculate success rate
      const totalProcessed = recentJobs?.reduce((sum, job) => sum + (job.processed_records || 0), 0) || 0;
      const totalEnriched = recentJobs?.reduce((sum, job) => sum + (job.enriched_records || 0), 0) || 0;
      const successRate = totalProcessed > 0 ? Math.round((totalEnriched / totalProcessed) * 100) : 0;

      // Get most recent job
      const { data: lastJob } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        enrichedCount: enrichedCount || 0,
        successRate,
        lastJob: lastJob || null,
        recentJobsCount: recentJobs?.length || 0,
      };
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Enrichment Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-warning animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthStatus = () => {
    if (!healthData?.lastJob) return { badge: 'Never Run', variant: 'secondary' as const };
    if (healthData.successRate >= 80) return { badge: 'Healthy', variant: 'default' as const };
    if (healthData.successRate >= 50) return { badge: 'Warning', variant: 'outline' as const };
    return { badge: 'Critical', variant: 'destructive' as const };
  };

  const healthStatus = getHealthStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Enrichment Health
          </div>
          <Badge variant={healthStatus.variant}>{healthStatus.badge}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Enriched Leads</p>
            <p className="text-2xl font-bold">{healthData?.enrichedCount || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Success Rate (7d)</p>
            <p className="text-2xl font-bold">{healthData?.successRate || 0}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Recent Jobs</p>
            <p className="text-2xl font-bold">{healthData?.recentJobsCount || 0}</p>
          </div>
        </div>

        {/* Last Job Status */}
        {healthData?.lastJob && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Last Enrichment Job</p>
              <div className="flex items-center gap-2">
                {getStatusIcon(healthData.lastJob.status)}
                <span className="text-sm capitalize">{healthData.lastJob.status}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {healthData.lastJob.accounts_enriched || healthData.lastJob.enriched_records || 0} enriched / {healthData.lastJob.processed_records || 0} processed
              </span>
              <span>
                {new Date(healthData.lastJob.created_at).toLocaleDateString()}
              </span>
            </div>
            {healthData.lastJob.error_message && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Error:</p>
                <p className="mt-1">{healthData.lastJob.error_message}</p>
              </div>
            )}
          </div>
        )}

        {/* View Logs Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            window.open(
              `https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/logs/edge-functions?search=enrich-unified`,
              '_blank'
            );
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Edge Function Logs
        </Button>
      </CardContent>
    </Card>
  );
}
