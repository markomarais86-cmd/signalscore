import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, DollarSign, Users, Clock, CheckCircle2, XCircle, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface DataCompleteness {
  employeeCountComplete: number;
  employeeCountTotal: number;
  employeeCountPercent: number;
  revenueRangeComplete: number;
  revenueRangeTotal: number;
  revenueRangePercent: number;
}

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
  const [completeness, setCompleteness] = useState<DataCompleteness | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [currentJob, setCurrentJob] = useState<EnrichmentJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<EnrichmentJob[]>([]);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadCompleteness();
    loadRecentJobs();
  }, [userProfile]);

  // Poll for job progress when enriching
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
          loadCompleteness();
          loadRecentJobs();
          
          if (data.status === 'completed') {
            toast({
              title: "Enrichment Complete",
              description: `Enriched ${data.enriched_records} accounts successfully!`,
            });
          } else {
            toast({
              title: "Enrichment Failed",
              description: data.error_message || "An error occurred during enrichment",
              variant: "destructive"
            });
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enriching, currentJob]);

  const loadCompleteness = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('employee_count, revenue_range')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      if (accounts) {
        const total = accounts.length;
        const employeeCountComplete = accounts.filter(a => a.employee_count !== null).length;
        const revenueRangeComplete = accounts.filter(a => a.revenue_range !== null).length;

        setCompleteness({
          employeeCountComplete,
          employeeCountTotal: total,
          employeeCountPercent: total > 0 ? Math.round((employeeCountComplete / total) * 100) : 0,
          revenueRangeComplete,
          revenueRangeTotal: total,
          revenueRangePercent: total > 0 ? Math.round((revenueRangeComplete / total) * 100) : 0,
        });
      }
    } catch (error) {
      console.error('Error loading completeness:', error);
    }
  };

  const loadRecentJobs = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('job_type', 'accounts')
        .order('started_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentJobs(data || []);
    } catch (error) {
      console.error('Error loading recent jobs:', error);
    }
  };

  const startEnrichment = async (provider: 'lovable_ai' | 'clearbit_free' | 'pdl' | 'smart_sequential') => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not found",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          provider: provider,
          job_type: 'accounts',
          status: 'pending',
          created_by: userProfile.user_id
        })
        .select()
        .single();

      if (jobError) throw jobError;

      setCurrentJob(job);
      setEnriching(true);

      // Call appropriate edge function
      const functionMap = {
        'clearbit_free': 'enrich-clearbit-free',
        'lovable_ai': 'enrich-firmographics',
        'pdl': 'enrich-pdl',
        'smart_sequential': 'smart-enrich'
      };
      const functionName = functionMap[provider];
      const { error: functionError } = await supabase.functions.invoke(functionName, {
        body: { job_id: job.id, jobId: job.id }
      });

      if (functionError) throw functionError;

      const providerNames = {
        'clearbit_free': 'Clearbit Free',
        'lovable_ai': 'AI',
        'pdl': 'People Data Labs',
        'smart_sequential': 'Smart Sequential (All Tiers)'
      };
      toast({
        title: "🚀 Enrichment started",
        description: `Processing your accounts with ${providerNames[provider]}`,
      });

      // Show real-time progress updates
      let updateCount = 0;
      const progressInterval = setInterval(async () => {
        const { data: updatedJob } = await supabase
          .from("enrichment_jobs")
          .select("*")
          .eq("id", job.id)
          .single();

        if (updatedJob) {
          if (updatedJob.status === "completed") {
            clearInterval(progressInterval);
            setEnriching(false);
            toast({
              title: `🎉 ${providerNames[provider]} enrichment complete!`,
              description: `✨ Enriched ${updatedJob.enriched_records} accounts, ${updatedJob.failed_records} failed`,
            });
            loadCompleteness();
            loadRecentJobs();
          } else if (updatedJob.status === "failed") {
            clearInterval(progressInterval);
            setEnriching(false);
            toast({
              title: "⚠️ Enrichment failed",
              description: updatedJob.error_message || "Unknown error occurred",
              variant: "destructive",
            });
          } else if (updatedJob.processed_records > 0 && updateCount % 3 === 0) {
            // Show progress every 3 checks
            toast({
              title: "📊 Progress update",
              description: `Processed ${updatedJob.processed_records} of ${updatedJob.total_records} accounts`,
            });
          }
          updateCount++;
        }
      }, 5000);

      // Clear interval after 10 minutes max
      setTimeout(() => {
        clearInterval(progressInterval);
        setEnriching(false);
      }, 600000);

    } catch (error: any) {
      console.error('Error starting enrichment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment",
        variant: "destructive"
      });
      setEnriching(false);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent < 50) return "bg-executive-red";
    if (percent < 80) return "bg-executive-amber";
    return "bg-executive-green";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-executive-green text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500 text-white"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (!completeness) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const missingEmployeeCount = completeness.employeeCountTotal - completeness.employeeCountComplete;
  const missingRevenueRange = completeness.revenueRangeTotal - completeness.revenueRangeComplete;
  const canEnrich = missingEmployeeCount > 0 || missingRevenueRange > 0;

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              AI-Powered Data Enrichment
            </CardTitle>
            <CardDescription>
              Automatically enrich missing firmographic data using AI
            </CardDescription>
          </div>
          {!enriching && canEnrich && (
            <div className="flex gap-2">
              <Button 
                onClick={() => startEnrichment('smart_sequential')} 
                disabled={loading}
                size="lg"
                className="gap-2 bg-gradient-to-r from-primary to-secondary"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Smart Enrich
                  </>
                )}
              </Button>
              <Button 
                onClick={() => startEnrichment('clearbit_free')} 
                disabled={loading}
                size="lg"
                className="gap-2"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    Clearbit Free
                  </>
                )}
              </Button>
              <Button 
                onClick={() => startEnrichment('lovable_ai')} 
                disabled={loading}
                size="lg"
                className="gap-2"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    AI Enrich
                  </>
                )}
              </Button>
              <Button 
                onClick={() => startEnrichment('pdl')} 
                disabled={loading}
                size="lg"
                className="gap-2"
                variant="secondary"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    PDL (Top 100)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee Count */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">Employee Count</span>
              </div>
              <span className="text-2xl font-bold">
                {completeness.employeeCountPercent}%
              </span>
            </div>
            <Progress 
              value={completeness.employeeCountPercent} 
              className="h-3"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{completeness.employeeCountComplete.toLocaleString()} complete</span>
              <span>{missingEmployeeCount.toLocaleString()} missing</span>
            </div>
          </div>

          {/* Revenue Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">Revenue Range</span>
              </div>
              <span className="text-2xl font-bold">
                {completeness.revenueRangePercent}%
              </span>
            </div>
            <Progress 
              value={completeness.revenueRangePercent} 
              className="h-3"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{completeness.revenueRangeComplete.toLocaleString()} complete</span>
              <span>{missingRevenueRange.toLocaleString()} missing</span>
            </div>
          </div>
        </div>

        {/* Active Job Progress */}
        {enriching && currentJob && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-semibold">Enriching Accounts...</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentJob.processed_records} / {currentJob.total_records}
                </span>
              </div>
              <Progress 
                value={(currentJob.processed_records / currentJob.total_records) * 100} 
                className="h-2"
              />
              <div className="flex gap-4 text-sm">
                <span className="text-executive-green">✓ {currentJob.enriched_records} enriched</span>
                {currentJob.failed_records > 0 && (
                  <span className="text-executive-red">✗ {currentJob.failed_records} failed</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Impact Estimate */}
        {!enriching && canEnrich && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-primary mt-1" />
                <div className="space-y-2">
                  <p className="font-semibold">Enrichment Options</p>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <span className="font-medium text-foreground">Clearbit Free:</span> Basic firmographics (unlimited, no API key needed)
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div>
                        <span className="font-medium text-foreground">AI Enrich:</span> Intelligent estimates using Gemini 2.5 Flash (~$2-3 for all, FREE during promotion)
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 text-purple-500 mt-0.5" />
                      <div>
                        <span className="font-medium text-foreground">PDL (Top 100):</span> High-accuracy enrichment for your best accounts (1,000 free/month)
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    💡 <span className="font-medium">Recommended:</span> Start with Clearbit Free, then use AI for missing data, finally PDL for top prospects.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Enrichment Jobs
            </h3>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div 
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusBadge(job.status)}
                    <span className="text-sm text-muted-foreground">
                      {new Date(job.started_at).toLocaleDateString()} at{' '}
                      {new Date(job.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-executive-green">
                      {job.enriched_records} enriched
                    </span>
                    {job.failed_records > 0 && (
                      <span className="text-executive-red">
                        {job.failed_records} failed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!canEnrich && (
          <Card className="border-executive-green/50 bg-executive-green/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-executive-green" />
                <p className="text-sm font-medium">All firmographic data is complete!</p>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
