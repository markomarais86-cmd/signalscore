import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Zap, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { calculateHybridCost, formatCost } from "@/utils/enrichment-cost-calculator";
import { LaunchPulseMark } from "@/components/BrandLogo";

interface DataQuality {
  totalAccounts: number;
  techStackCoverage: number;
  fundingCoverage: number;
  industryCoverage: number;
  employeeCoverage: number;
  linkedinCoverage: number;
  overallCompleteness: number;
}

interface PriorityAccount {
  id: string;
  name: string;
  domain: string;
  propensity_score: number;
  missing_fields: string[];
}

export function SmartEnrichmentPanel() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [aiEnriching, setAiEnriching] = useState(false);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [priorityAccounts, setPriorityAccounts] = useState<PriorityAccount[]>([]);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadDataQuality();
      loadPriorityAccounts();
    }
  }, [userProfile?.org_id]);

  const loadDataQuality = async () => {
    if (!userProfile?.org_id) return;

    try {
      setLoading(true);

      // Get total accounts
      const { count: totalAccounts } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id);

      // Calculate coverage for each field
      const { count: withTechStack } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .not("tech_stack", "is", null);

      const { count: withFunding } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .not("total_raised_usd", "is", null);

      const { count: withIndustry } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .not("industry_raw", "is", null);

      const { count: withEmployees } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .not("employee_count", "is", null);

      const { count: withLinkedin } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .not("linkedin_url", "is", null);

      const total = totalAccounts || 1;
      const techStackCoverage = ((withTechStack || 0) / total) * 100;
      const fundingCoverage = ((withFunding || 0) / total) * 100;
      const industryCoverage = ((withIndustry || 0) / total) * 100;
      const employeeCoverage = ((withEmployees || 0) / total) * 100;
      const linkedinCoverage = ((withLinkedin || 0) / total) * 100;
      const overallCompleteness = (techStackCoverage + fundingCoverage + industryCoverage + employeeCoverage + linkedinCoverage) / 5;

      setDataQuality({
        totalAccounts: total,
        techStackCoverage,
        fundingCoverage,
        industryCoverage,
        employeeCoverage,
        linkedinCoverage,
        overallCompleteness,
      });
    } catch (error) {
      console.error("Error loading data quality:", error);
      toast.error("Failed to load data quality metrics");
    } finally {
      setLoading(false);
    }
  };

  const loadPriorityAccounts = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Get high-fit accounts with missing data
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("id, name, domain, propensity_score, tech_stack, total_raised_usd, industry_raw, employee_count")
        .eq("org_id", userProfile.org_id)
        .gte("propensity_score", 70)
        .not("domain", "is", null)
        .order("propensity_score", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Calculate missing fields for each account
      const priority = accounts?.map(account => {
        const missing: string[] = [];
        if (!account.tech_stack || account.tech_stack.length === 0) missing.push("tech_stack");
        if (!account.total_raised_usd) missing.push("funding");
        if (!account.industry_raw) missing.push("industry");
        if (!account.employee_count) missing.push("employees");

        return {
          id: account.id,
          name: account.name || "Unknown",
          domain: account.domain || "",
          propensity_score: account.propensity_score || 0,
          missing_fields: missing,
        };
      }).filter(a => a.missing_fields.length > 0) || [];

      setPriorityAccounts(priority.slice(0, 100));
    } catch (error) {
      console.error("Error loading priority accounts:", error);
    }
  };

  const startBatchEnrichment = async () => {
    if (!userProfile?.org_id || priorityAccounts.length === 0) return;

    try {
      setEnriching(true);
      toast.info(`Starting enrichment for ${priorityAccounts.length} high-priority accounts...`);

      let enriched = 0;
      const batchSize = 10;

      for (let i = 0; i < priorityAccounts.length; i += batchSize) {
        const batch = priorityAccounts.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (account) => {
            try {
              // Enrich tech stack if missing
              if (account.missing_fields.includes("tech_stack")) {
                await supabase.functions.invoke("enrich-tech-stack", {
                  body: {
                    account_id: account.id,
                    domain: account.domain,
                    org_id: userProfile.org_id,
                  },
                });
              }

              // Enrich funding data if missing
              if (account.missing_fields.includes("funding")) {
                await supabase.functions.invoke("enrich-funding-data", {
                  body: {
                    account_id: account.id,
                    company_name: account.name,
                    domain: account.domain,
                    org_id: userProfile.org_id,
                  },
                });
              }

              enriched++;
            } catch (error) {
              console.error(`Failed to enrich account ${account.name}:`, error);
            }
          })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success(`Enriched ${enriched} accounts successfully!`);
      loadDataQuality();
      loadPriorityAccounts();
    } catch (error) {
      console.error("Error during batch enrichment:", error);
      toast.error("Batch enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  const startFreeAIEnrichment = async () => {
    if (!userProfile?.org_id) return;

    try {
      setAiEnriching(true);
      toast.info("Starting Free AI Enrichment...", {
        description: "AI-powered estimates - auto-starting now!"
      });

      // Get count of accounts needing enrichment
      const { count: needsEnrichment } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id)
        .not("domain", "is", null)
        .or("employee_count.is.null,revenue_range.is.null,industry_raw.is.null,linkedin_url.is.null");

      const totalRecords = needsEnrichment || priorityAccounts.length || 100;

      // Create enrichment job with 'processing' status (auto-start)
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          provider: 'ai_free',
          job_type: 'accounts',
          status: 'processing',
          started_at: new Date().toISOString(),
          total_records: totalRecords
        })
        .select()
        .single();

      if (jobError) throw jobError;

      toast.success("Enrichment job created and started!", {
        description: `Processing ${totalRecords.toLocaleString()} accounts`
      });

      // Immediately invoke the edge function (auto-start)
      const { error } = await supabase.functions.invoke('enrich-ai-only', {
        body: { jobId: job.id, batchSize: 100 }
      });

      if (error) {
        console.error("Edge function error:", error);
        // Job will handle its own status, don't fail here
      }

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: jobStatus } = await supabase
          .from('enrichment_jobs')
          .select('status, accounts_enriched, enriched_records, processed_records')
          .eq('id', job.id)
          .single();

        if (jobStatus?.status === 'completed' || jobStatus?.status === 'completed_with_errors') {
          clearInterval(pollInterval);
          const enrichedCount = jobStatus.accounts_enriched || jobStatus.enriched_records || 0;
          toast.success(`AI enriched ${enrichedCount} accounts!`, {
            description: "No API credits used"
          });
          loadDataQuality();
          loadPriorityAccounts();
          setAiEnriching(false);
        } else if (jobStatus?.status === 'failed') {
          clearInterval(pollInterval);
          toast.error("AI enrichment failed");
          setAiEnriching(false);
        } else if (jobStatus?.status === 'paused') {
          // Job paused for auto-resume, keep polling
          toast.info(`Processing... ${jobStatus.processed_records || 0} accounts done`);
        }
      }, 3000);

      // Stop polling after 10 minutes (longer for large jobs)
      setTimeout(() => {
        clearInterval(pollInterval);
        setAiEnriching(false);
      }, 600000);

    } catch (error) {
      console.error("Error during AI enrichment:", error);
      toast.error("AI enrichment failed");
      setAiEnriching(false);
    }
  };

  if (loading) {
    return <div>Loading enrichment data...</div>;
  }

  if (!dataQuality) {
    return null;
  }

  const costEstimate = calculateHybridCost(priorityAccounts.length);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LaunchPulseMark className="w-5 h-5" />
                Smart Enrichment Priority Queue
              </CardTitle>
              <CardDescription>
                AI-powered enrichment for high-value accounts with missing data
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg">
              {priorityAccounts.length} Accounts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Quality Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tech Stack</span>
                <span className="text-sm text-muted-foreground">
                  {dataQuality.techStackCoverage.toFixed(0)}%
                </span>
              </div>
              <Progress value={dataQuality.techStackCoverage} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Funding</span>
                <span className="text-sm text-muted-foreground">
                  {dataQuality.fundingCoverage.toFixed(0)}%
                </span>
              </div>
              <Progress value={dataQuality.fundingCoverage} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Industry</span>
                <span className="text-sm text-muted-foreground">
                  {dataQuality.industryCoverage.toFixed(0)}%
                </span>
              </div>
              <Progress value={dataQuality.industryCoverage} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Employees</span>
                <span className="text-sm text-muted-foreground">
                  {dataQuality.employeeCoverage.toFixed(0)}%
                </span>
              </div>
              <Progress value={dataQuality.employeeCoverage} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">LinkedIn</span>
                <span className="text-sm text-muted-foreground">
                  {dataQuality.linkedinCoverage.toFixed(0)}%
                </span>
              </div>
              <Progress value={dataQuality.linkedinCoverage} />
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Estimated Cost</p>
                <p className="text-xs text-muted-foreground">
                  For {priorityAccounts.length} high-priority accounts
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCost(costEstimate.totalCost)}</p>
              <p className="text-xs text-muted-foreground">
                ~{costEstimate.estimatedCredits} credits
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">
                Priority: High ICP Fit (70+) + Missing Data
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={startFreeAIEnrichment}
                disabled={aiEnriching || enriching}
                size="lg"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {aiEnriching ? "AI Enriching..." : "Free AI Enrich"}
              </Button>
              <Button
                onClick={startBatchEnrichment}
                disabled={enriching || aiEnriching || priorityAccounts.length === 0}
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                {enriching ? "Enriching..." : `Enrich Top ${Math.min(priorityAccounts.length, 100)}`}
              </Button>
            </div>
          </div>

          {/* Top Priority Accounts Preview */}
          {priorityAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Top Priority Accounts:</p>
              <div className="space-y-1">
                {priorityAccounts.slice(0, 5).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-2 border rounded text-sm"
                  >
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.domain}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{account.propensity_score}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {account.missing_fields.length} fields
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
