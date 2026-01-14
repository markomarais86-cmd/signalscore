import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Zap, 
  HelpCircle, 
  TrendingUp, 
  AlertCircle,
  Play,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { LaunchPulseMark } from "@/components/BrandLogo";

interface DataGaps {
  total: number;
  needsEmployee: number;
  needsRevenue: number;
  needsIndustry: number;
  needsLinkedin: number;
  needsCountry: number;
}

interface ActiveJob {
  id: string;
  status: string;
  processed_records: number;
  accounts_enriched: number;
  fields_enriched: number;
  total_records: number;
  estimated_completion_at: string | null;
}

const BATCH_OPTIONS = [
  { value: "100", label: "100 accounts" },
  { value: "500", label: "500 accounts" },
  { value: "1000", label: "1,000 accounts" },
  { value: "5000", label: "5,000 accounts" },
  { value: "all", label: "All accounts" },
];

export function EnrichmentControlPanel() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [dataGaps, setDataGaps] = useState<DataGaps | null>(null);
  const [batchSize, setBatchSize] = useState("100");
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadDataGaps();
      checkActiveJob();
    }
  }, [userProfile?.org_id]);

  // Poll for active job progress
  useEffect(() => {
    if (!activeJob || !["processing", "paused"].includes(activeJob.status)) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("enrichment_jobs")
        .select("id, status, processed_records, accounts_enriched, fields_enriched, total_records, estimated_completion_at")
        .eq("id", activeJob.id)
        .single();

      if (data) {
        setActiveJob(data as ActiveJob);
        if (data.status === "completed") {
          toast.success(`Enrichment complete! ${data.accounts_enriched} accounts enriched.`);
          loadDataGaps();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJob?.id, activeJob?.status]);

  const loadDataGaps = async () => {
    if (!userProfile?.org_id) return;
    setLoading(true);

    try {
      const { count: total } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id);

      const { count: needsEmployee } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .is("employee_count", null);

      const { count: needsRevenue } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .is("revenue_range", null);

      const { count: needsIndustry } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .is("industry_raw", null);

      const { count: needsLinkedin } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .is("linkedin_url", null);

      const { count: needsCountry } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .is("country", null);

      setDataGaps({
        total: total || 0,
        needsEmployee: needsEmployee || 0,
        needsRevenue: needsRevenue || 0,
        needsIndustry: needsIndustry || 0,
        needsLinkedin: needsLinkedin || 0,
        needsCountry: needsCountry || 0,
      });
    } catch (error) {
      console.error("Error loading data gaps:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    if (!userProfile?.org_id) return;

    const { data } = await supabase
      .from("enrichment_jobs")
      .select("id, status, processed_records, accounts_enriched, fields_enriched, total_records, estimated_completion_at")
      .eq("org_id", userProfile.org_id)
      .in("status", ["processing", "paused", "pending"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveJob(data as ActiveJob);
    }
  };

  const accountsToEnrich = useMemo(() => {
    if (!dataGaps) return 0;
    if (batchSize === "all") return dataGaps.total;
    return Math.min(parseInt(batchSize), dataGaps.total);
  }, [batchSize, dataGaps]);

  const startEnrichment = async () => {
    if (!userProfile?.org_id) return;

    try {
      setStarting(true);
      
      const { data: result, error } = await supabase.functions.invoke("enrich-free-orchestrator", {
        body: {
          org_id: userProfile.org_id,
          create_new: true,
          total_records: accountsToEnrich,
        },
      });

      if (error) throw error;

      toast.success("Enrichment started!", {
        description: `Processing ${accountsToEnrich.toLocaleString()} accounts with auto-continuation`,
      });

      // Refresh to get the new job
      await checkActiveJob();
    } catch (error) {
      console.error("Error starting enrichment:", error);
      toast.error("Failed to start enrichment");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const progressPercent = activeJob 
    ? Math.round((activeJob.processed_records / activeJob.total_records) * 100) 
    : 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Main Enrichment Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LaunchPulseMark className="h-6 w-6" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Enrich Your Data
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Launch Pulse uses AI to research companies on the web and fill in missing data like employee count, revenue, industry, and LinkedIn URLs. No API credits required.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription>
                    AI-powered enrichment fills in missing company data automatically
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                Free
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Data Gaps Overview */}
            {dataGaps && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 rounded-lg border bg-muted/30">
                  <p className="text-2xl font-bold">{dataGaps.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Accounts</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-orange-600">{dataGaps.needsEmployee.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Need Employee Count</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-orange-600">{dataGaps.needsRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Need Revenue</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-orange-600">{dataGaps.needsLinkedin.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Need LinkedIn</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-orange-600">{dataGaps.needsIndustry.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Need Industry</p>
                </div>
              </div>
            )}

            {/* Active Job Progress */}
            {activeJob && ["processing", "paused"].includes(activeJob.status) && (
              <div className="p-4 rounded-lg border bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">Enrichment in Progress</span>
                    {activeJob.status === "paused" && (
                      <Badge variant="secondary" className="text-xs">Auto-resuming...</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {activeJob.accounts_enriched.toLocaleString()} accounts enriched
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{activeJob.processed_records.toLocaleString()} / {activeJob.total_records.toLocaleString()} processed</span>
                  <span>{progressPercent}% complete</span>
                </div>
              </div>
            )}

            {/* Completed Job Status */}
            {activeJob && activeJob.status === "completed" && (
              <div className="p-4 rounded-lg border bg-green-500/5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Last job completed</p>
                  <p className="text-sm text-muted-foreground">
                    {activeJob.accounts_enriched.toLocaleString()} accounts enriched, {activeJob.fields_enriched?.toLocaleString() || 0} data points added
                  </p>
                </div>
              </div>
            )}

            {/* Start New Enrichment */}
            {(!activeJob || !["processing", "paused"].includes(activeJob.status)) && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium">How many accounts to enrich?</label>
                  <Select value={batchSize} onValueChange={setBatchSize}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BATCH_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.value === "all" 
                            ? `All (${dataGaps?.total.toLocaleString() || 0})` 
                            : opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Accounts to enrich</p>
                    <p className="text-xl font-bold">{accountsToEnrich.toLocaleString()}</p>
                  </div>
                  <Button
                    size="lg"
                    onClick={startEnrichment}
                    disabled={starting || accountsToEnrich === 0}
                    className="gap-2"
                  >
                    {starting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start Enrichment
                  </Button>
                </div>
              </div>
            )}

            {/* Info Note */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Launch Pulse enrichment runs automatically until complete. Large jobs (10,000+ accounts) 
                will process in batches with auto-continuation. You can leave this page - enrichment 
                continues in the background.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
