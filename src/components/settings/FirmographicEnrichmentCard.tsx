import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Zap, AlertCircle, Database } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface EnrichmentJob {
  id: string;
  status: string;
  total_records: number;
  processed_records: number;
  enriched_records: number;
  failed_records: number;
  progress_percentage: number;
}

export function FirmographicEnrichmentCard() {
  const [missingCount, setMissingCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<EnrichmentJob | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadCounts();
    checkActiveJob();
  }, [userProfile]);

  // Poll for job progress
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('id', currentJob.id)
        .single();

      if (!error && data) {
        setCurrentJob(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          loadCounts();
          toast({
            title: data.status === 'completed' ? "Enrichment Complete" : "Enrichment Failed",
            description: `Enriched ${data.enriched_records} of ${data.total_records} accounts`,
            variant: data.status === 'completed' ? "default" : "destructive"
          });
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentJob?.id, currentJob?.status]);

  const loadCounts = async () => {
    if (!userProfile?.org_id) return;

    const { data, error } = await supabase
      .from('accounts')
      .select('employee_count, domain')
      .eq('org_id', userProfile.org_id);

    if (!error && data) {
      setTotalCount(data.length);
      const missing = data.filter(a => a.employee_count === null && a.domain !== null).length;
      setMissingCount(missing);
    }
  };

  const checkActiveJob = async () => {
    if (!userProfile?.org_id) return;

    const { data } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('org_id', userProfile.org_id)
      .eq('job_type', 'accounts')
      .eq('provider', 'smart_waterfall')
      .in('status', ['processing', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) setCurrentJob(data);
  };

  const enrichAll = async () => {
    if (!userProfile?.org_id) return;
    setLoading(true);

    try {
      // Fetch accounts needing enrichment
      const { data: accounts, error: fetchError } = await supabase
        .from('accounts')
        .select('id, external_id, name, domain')
        .eq('org_id', userProfile.org_id)
        .is('employee_count', null)
        .not('domain', 'is', null)
        .limit(500);
      
      if (fetchError) throw fetchError;
      
      const records = (accounts || []).map(a => ({
        id: a.id,
        external_id: a.external_id,
        name: a.name,
        domain: a.domain
      }));

      const { data, error } = await supabase.functions.invoke('enrich-unified', {
        body: { 
          org_id: userProfile.org_id,
          record_type: 'account',
          records,
          config: { skipPaidProviders: true }
        }
      });

      if (error) throw error;

      if (data.jobId) {
        setCurrentJob({
          id: data.jobId,
          status: 'processing',
          total_records: data.total,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0,
          progress_percentage: 0
        });
      }

      toast({ title: "Enrichment Started", description: data.message });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = currentJob && ['processing', 'pending'].includes(currentJob.status);
  const completedPercent = totalCount > 0 ? Math.round(((totalCount - missingCount) / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Account Enrichment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{(totalCount - missingCount).toLocaleString()} / {totalCount.toLocaleString()} accounts enriched</span>
            <span className={completedPercent < 50 ? 'text-destructive' : completedPercent < 80 ? 'text-amber-600' : 'text-executive-green'}>
              {completedPercent}%
            </span>
          </div>
          <Progress value={completedPercent} className="h-2" />
        </div>

        {/* Active Job Progress */}
        {isProcessing && currentJob ? (
          <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">Enriching {currentJob.total_records.toLocaleString()} accounts...</span>
            </div>
            <Progress value={currentJob.progress_percentage || 0} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span className="text-executive-green">{currentJob.enriched_records || 0} enriched</span>
              <span>{currentJob.processed_records || 0} / {currentJob.total_records} processed</span>
              {currentJob.failed_records > 0 && (
                <span className="text-destructive">{currentJob.failed_records} failed</span>
              )}
            </div>
          </div>
        ) : missingCount > 0 ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{missingCount.toLocaleString()}</strong> accounts missing employee data
              </p>
            </div>
            <Button onClick={enrichAll} disabled={loading} className="w-full" size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Enrich All {missingCount.toLocaleString()} Accounts
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Uses Apollo → PDL → AI waterfall. Runs in background.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 rounded-lg border-2 border-dashed bg-muted/30">
            <CheckCircle2 className="h-5 w-5 text-executive-green" />
            <span className="font-medium">All accounts have employee data!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}