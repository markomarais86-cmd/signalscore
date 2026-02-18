import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDataOrgId } from "@/hooks/use-data-org";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Zap, 
  Users, 
  DollarSign, 
  Building2, 
  Linkedin, 
  MapPin,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";

interface DataGap {
  field: string;
  label: string;
  icon: React.ElementType;
  missing: number;
  color: string;
}

interface ActiveJob {
  id: string;
  status: string;
  processed_records: number;
  accounts_enriched: number;
  fields_enriched: number;
  total_records: number;
  error_message?: string | null;
}

const BATCH_OPTIONS = [
  { value: "100", label: "100 accounts" },
  { value: "500", label: "500 accounts" },
  { value: "1000", label: "1,000 accounts" },
  { value: "5000", label: "5,000 accounts" },
  { value: "all", label: "All accounts" },
];

export function DataGapsVisualization() {
  const { userProfile } = useAuth();
  const { dataOrgId, effectiveOrgId } = useDataOrgId();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [dataGaps, setDataGaps] = useState<DataGap[]>([]);
  const [batchSize, setBatchSize] = useState("100");
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);

  useEffect(() => {
    if (dataOrgId) {
      loadDataGaps();
      checkActiveJob();
    }
  }, [dataOrgId]);

  // Poll for active job progress
  useEffect(() => {
    // Poll while job is in progress (including paused for brief window)
    if (!activeJob || ["completed", "cancelled"].includes(activeJob.status)) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("enrichment_jobs")
        .select("id, status, processed_records, accounts_enriched, fields_enriched, total_records, error_message")
        .eq("id", activeJob.id)
        .single();

      if (data) {
        setActiveJob(data as ActiveJob);
        if (data.status === "completed") {
          toast.success(`Enrichment complete! ${data.accounts_enriched} accounts enriched.`);
          loadDataGaps();
          // Clear active job after brief display
          setTimeout(() => setActiveJob(null), 5000);
        } else if (data.status === "failed") {
          toast.error(`Enrichment interrupted after ${data.accounts_enriched || 0} accounts.`);
          loadDataGaps(); // Refresh gaps even on failure
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJob?.id, activeJob?.status]);

  const loadDataGaps = async () => {
    if (!dataOrgId) return;
    // Only show loading spinner on initial load, not refreshes
    const isInitialLoad = dataGaps.length === 0;
    if (isInitialLoad) setLoading(true);

    try {
      // Run all queries in parallel for better performance
      const [
        { count: total },
        { count: missingEmployees },
        { count: missingRevenue },
        { count: missingIndustry },
        { count: missingSubIndustry },
        { count: missingLinkedin },
        { count: missingCountry }
      ] = await Promise.all([
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId).is("employee_count", null),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId).is("revenue_range", null),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId).is("industry_raw", null),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId).is("sub_industry", null),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId).is("linkedin_url", null),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", dataOrgId).is("country", null),
      ]);

      const gaps: DataGap[] = [
        { field: "linkedin_url", label: "LinkedIn", icon: Linkedin, color: "hsl(210 90% 55%)", missing: missingLinkedin || 0 },
        { field: "employee_count", label: "Employee Count", icon: Users, color: "hsl(var(--primary))", missing: missingEmployees || 0 },
        { field: "revenue_range", label: "Revenue", icon: DollarSign, color: "hsl(var(--signal-high))", missing: missingRevenue || 0 },
        { field: "industry_raw", label: "Industry", icon: Building2, color: "hsl(var(--signal-medium))", missing: missingIndustry || 0 },
        { field: "sub_industry", label: "Sub-Industry", icon: Building2, color: "hsl(280 70% 50%)", missing: missingSubIndustry || 0 },
        { field: "country", label: "Country", icon: MapPin, color: "hsl(var(--signal-low))", missing: missingCountry || 0 },
      ];

      setTotalAccounts(total || 0);
      setDataGaps(gaps.sort((a, b) => b.missing - a.missing));
    } catch (error) {
      console.error("Error loading data gaps:", error);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    if (!effectiveOrgId) return;

    // Only check for truly active jobs (not failed - those are handled separately)
    const { data } = await supabase
      .from("enrichment_jobs")
      .select("id, status, processed_records, accounts_enriched, fields_enriched, total_records, error_message")
      .eq("org_id", effectiveOrgId)
      .in("status", ["processing", "paused", "pending"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveJob(data as ActiveJob);
    }
  };

  const resumeJob = async () => {
    if (!activeJob || !effectiveOrgId || !dataOrgId) return;

    try {
      setStarting(true);
      
      // Fetch fresh accounts with gaps for the resumed job
      const gapFields = dataGaps.filter(g => g.missing > 0).map(g => `${g.field}.is.null`);
      const { data: accounts } = await supabase
        .from("accounts")
        .select("external_id, name, domain, industry_norm, industry_raw, sub_industry, employee_count, revenue_range, country, state_province, city")
        .eq("org_id", dataOrgId)
        .or(gapFields.length > 0 ? gapFields.join(",") : "employee_count.is.null")
        .not("domain", "is", null)
        .limit(100);

      const { error } = await supabase.functions.invoke("enrich-unified", {
        body: {
          job_id: activeJob.id,
          org_id: effectiveOrgId,
          record_type: 'account',
          records: accounts || [],
          config: { skipPaidProviders: true }
        },
      });

      if (error) throw error;

      toast.success("Resuming enrichment job...");
      await checkActiveJob();
    } catch (error) {
      console.error("Error resuming job:", error);
      toast.error("Failed to resume job");
    } finally {
      setStarting(false);
    }
  };

  const accountsToEnrich = batchSize === "all" 
    ? totalAccounts 
    : Math.min(parseInt(batchSize), totalAccounts);

  const startEnrichment = async () => {
    if (!effectiveOrgId || !dataOrgId) return;

    try {
      setStarting(true);
      
      // Build OR filter for fields with gaps
      const gapFields = dataGaps.filter(g => g.missing > 0).map(g => `${g.field}.is.null`);
      if (gapFields.length === 0) {
        toast.info("No data gaps found!");
        return;
      }

      // Fetch actual accounts with missing data
      const limit = batchSize === "all" ? totalAccounts : parseInt(batchSize);
      const { data: accounts, error: fetchError } = await supabase
        .from("accounts")
        .select("external_id, name, domain, industry_norm, industry_raw, sub_industry, employee_count, revenue_range, country, state_province, city")
        .eq("org_id", dataOrgId)
        .or(gapFields.join(","))
        .not("domain", "is", null)
        .limit(Math.min(limit, 100)); // Edge function max is 100 per request

      if (fetchError) throw fetchError;

      if (!accounts || accounts.length === 0) {
        toast.info("No accounts with data gaps and a domain found.");
        return;
      }

      const { error } = await supabase.functions.invoke("enrich-unified", {
        body: {
          org_id: effectiveOrgId,
          record_type: 'account',
          records: accounts,
          config: { skipPaidProviders: true }
        },
      });

      if (error) throw error;

      toast.success("Enrichment started!", {
        description: `Processing ${accounts.length.toLocaleString()} accounts`,
      });

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
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const maxMissing = Math.max(...dataGaps.map(g => g.missing), 1);
  const progressPercent = activeJob 
    ? Math.min(100, Math.round((activeJob.processed_records / activeJob.total_records) * 100))
    : 0;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Data Gaps
            </CardTitle>
            <CardDescription>
              Fields that need enrichment across {totalAccounts.toLocaleString()} accounts
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={loadDataGaps} 
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
              Free Enrichment
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Data Gaps */}
        <div className="space-y-3">
          {dataGaps.map(gap => {
            const Icon = gap.icon;
            const percentage = totalAccounts > 0 ? Math.round((gap.missing / totalAccounts) * 100) : 0;
            
            return (
              <div key={gap.field} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{gap.label}</span>
                </div>
                <div className="flex-1">
                  <Progress 
                    value={(gap.missing / maxMissing) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="text-right w-24 shrink-0">
                  <span className="text-sm font-medium">{gap.missing.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-1">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Job Progress */}
        {activeJob && ["processing", "paused"].includes(activeJob.status) && (
          <div className="p-4 rounded-lg border bg-primary/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">Enrichment in Progress</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {activeJob.accounts_enriched?.toLocaleString() || 0} enriched
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.min(activeJob.processed_records || 0, activeJob.total_records || 0).toLocaleString()} / {activeJob.total_records?.toLocaleString() || 0}</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        )}

        {/* Completed Job Status */}
        {activeJob && activeJob.status === "completed" && (
          <div className="p-3 rounded-lg border bg-green-500/5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-700">Last job completed</p>
              <p className="text-sm text-muted-foreground">
                {activeJob.accounts_enriched?.toLocaleString() || 0} accounts, {activeJob.fields_enriched?.toLocaleString() || 0} fields
              </p>
            </div>
          </div>
        )}

        {/* Failed Job Status with Resume Button */}
        {activeJob && activeJob.status === "failed" && (
          <div className="p-3 rounded-lg border bg-destructive/5 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Enrichment interrupted</p>
              <p className="text-sm text-muted-foreground">
                {activeJob.accounts_enriched?.toLocaleString() || 0} accounts enriched before stopping
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={resumeJob}
              disabled={starting}
              className="gap-1"
            >
              {starting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Resume
            </Button>
          </div>
        )}

        {/* Start Enrichment Controls */}
        {(!activeJob || !["processing", "paused", "failed"].includes(activeJob.status)) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Select value={batchSize} onValueChange={setBatchSize}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BATCH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.value === "all" 
                      ? `All (${totalAccounts.toLocaleString()})` 
                      : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={startEnrichment}
              disabled={starting || accountsToEnrich === 0}
              className="gap-2 flex-1 sm:flex-none"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Fill Data Gaps ({accountsToEnrich.toLocaleString()})
            </Button>
          </div>
        )}

        {/* Info Note */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          AI-powered enrichment runs in the background. Large jobs process in batches with auto-continuation.
        </p>
      </CardContent>
    </Card>
  );
}
