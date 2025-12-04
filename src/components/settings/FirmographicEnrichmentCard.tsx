import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, Zap, AlertCircle, Database } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface EnrichmentJob {
  id: string;
  status: string;
  total_records: number;
  processed_records: number;
  enriched_records: number;
  failed_records: number;
  started_at: string;
  completed_at: string | null;
}

export function FirmographicEnrichmentCard() {
  const [missingCount, setMissingCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [currentJob, setCurrentJob] = useState<EnrichmentJob | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadCounts();
  }, [userProfile]);

  // Poll for job progress
  useEffect(() => {
    if (!enriching || !currentJob) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('id', currentJob.id)
        .single();

      if (!error && data) {
        setCurrentJob(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setEnriching(false);
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
  }, [enriching, currentJob]);

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

  const enrichAll = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);

    try {
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          job_type: 'accounts',
          provider: 'smart_waterfall',
          status: 'pending',
          total_records: missingCount,
          batch_size: missingCount,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0
        })
        .select()
        .single();

      if (jobError) throw jobError;

      setCurrentJob(job);
      setEnriching(true);

      const { error: funcError } = await supabase.functions.invoke('smart-enrich', {
        body: { jobId: job.id, batchSize: missingCount }
      });

      if (funcError) throw funcError;

      toast({ title: "Enrichment Started", description: `Processing ${missingCount.toLocaleString()} accounts...` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setEnriching(false);
    } finally {
      setLoading(false);
    }
  };

  const completedPercent = totalCount > 0 ? Math.round(((totalCount - missingCount) / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Employee Count Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{(totalCount - missingCount).toLocaleString()} / {totalCount.toLocaleString()} accounts</span>
            <span className={completedPercent < 50 ? 'text-destructive' : completedPercent < 80 ? 'text-amber-600' : 'text-executive-green'}>
              {completedPercent}% complete
            </span>
          </div>
          <Progress value={completedPercent} className="h-3" />
        </div>

        {/* Action or Progress */}
        {enriching && currentJob ? (
          <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">Enriching {currentJob.total_records.toLocaleString()} accounts...</span>
            </div>
            <Progress 
              value={currentJob.total_records > 0 ? (currentJob.processed_records / currentJob.total_records) * 100 : 0} 
              className="h-2"
            />
            <div className="flex justify-between text-sm">
              <span className="text-executive-green">{currentJob.enriched_records} enriched</span>
              <span>{currentJob.processed_records} / {currentJob.total_records} processed</span>
            </div>
          </div>
        ) : missingCount > 0 ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{missingCount.toLocaleString()}</strong> accounts missing employee count data
              </p>
            </div>
            <Button onClick={enrichAll} disabled={loading} className="w-full" size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Enrich All {missingCount.toLocaleString()} Accounts
            </Button>
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
