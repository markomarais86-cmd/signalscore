import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Users, DollarSign, Globe, PlayCircle, CheckCircle, AlertCircle, ExternalLink, UserSearch, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface EnrichmentStats {
  total: number;
  missingEmployeeCount: number;
  missingRevenue: number;
  missingIndustry: number;
  missingCountry: number;
  needsEnrichment: number;
}

interface EnrichmentJob {
  id: string;
  status: string;
  total_records: number;
  processed_records: number;
  enriched_records: number;
  failed_records: number;
  started_at: string;
  completed_at?: string;
  created_at: string;
  provider: string;
  error_message?: string;
  progress_percentage?: number;
}

export function BulkAccountEnrichment() {
  const { toast } = useToast();
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [activeJob, setActiveJob] = useState<EnrichmentJob | null>(null);
  const [batchSize, setBatchSize] = useState<string>("100");
  const [provider, setProvider] = useState<string>("smart");
  const [enableContactDiscovery, setEnableContactDiscovery] = useState(true);
  const [highFitAccountsCount, setHighFitAccountsCount] = useState(0);

  useEffect(() => {
    loadStats();
    loadActiveJob();

    // Subscribe to job updates
    const channel = supabase
      .channel('account-enrichment-jobs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrichment_jobs',
        filter: `job_type=eq.accounts`
      }, () => {
        loadActiveJob();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) return;

      // Get stats for accounts needing enrichment
      const { data: accounts } = await supabase
        .from('accounts')
        .select('employee_count, revenue_range, industry_norm, country')
        .eq('org_id', profile.org_id);

      if (accounts) {
        const missingEmployeeCount = accounts.filter(a => !a.employee_count).length;
        const missingRevenue = accounts.filter(a => !a.revenue_range).length;
        const missingIndustry = accounts.filter(a => !a.industry_norm).length;
        const missingCountry = accounts.filter(a => !a.country).length;
        
        // Accounts needing enrichment are those missing any critical field
        const needsEnrichment = accounts.filter(a => 
          !a.employee_count || !a.revenue_range || !a.industry_norm || !a.country
        ).length;

        setStats({
          total: accounts.length,
          missingEmployeeCount,
          missingRevenue,
          missingIndustry,
          missingCountry,
          needsEnrichment
        });

        // Count high-fit accounts for discovery estimate
        const { count } = await supabase
          .from('scores')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.org_id)
          .gte('fit', 70);
        
        setHighFitAccountsCount(count || 0);
      }
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast({
        title: "Error",
        description: "Failed to load enrichment statistics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadActiveJob = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) return;

      const { data: job } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('job_type', 'accounts')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveJob(job);
    } catch (error) {
      console.error('Error loading active job:', error);
    }
  };

  const startEnrichment = async () => {
    setEnriching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: profile.org_id,
          provider: provider,
          job_type: 'accounts',
          status: 'pending',
          batch_size: parseInt(batchSize),
          total_records: stats?.needsEnrichment || 0,
          created_by: user.id
        })
        .select()
        .single();

      if (jobError) throw jobError;

      console.log('Starting enrichment job:', job.id, 'with provider:', provider);

      // Trigger enrichment edge function
      const functionName = provider === 'smart' ? 'smart-enrich' : 'enrich-accounts';
      const { error: enrichError } = await supabase.functions.invoke(functionName, {
        body: { 
          jobId: job.id,
          batchSize: parseInt(batchSize)
        }
      });

      if (enrichError) {
        console.error('Edge function error:', enrichError);
        throw enrichError;
      }

      toast({
        title: "Enrichment Started",
        description: `Processing ${stats?.needsEnrichment || 0} accounts with ${provider} enrichment`,
      });

      setActiveJob(job);
      loadStats();
    } catch (error: any) {
      console.error('Error starting enrichment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment job",
        variant: "destructive"
      });
    } finally {
      setEnriching(false);
    }
  };

  const getProgress = () => {
    if (!activeJob) return 0;
    if (activeJob.progress_percentage) return activeJob.progress_percentage;
    if (!activeJob.total_records) return 0;
    return Math.round((activeJob.processed_records / activeJob.total_records) * 100);
  };

  const getStatusIcon = () => {
    if (!activeJob) return null;
    
    switch (activeJob.status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <PlayCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missingEmployeeCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total ? Math.round((stats.missingEmployeeCount / stats.total) * 100) : 0}% missing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missingRevenue.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total ? Math.round((stats.missingRevenue / stats.total) * 100) : 0}% missing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Country</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missingCountry.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total ? Math.round((stats.missingCountry / stats.total) * 100) : 0}% missing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Account Enrichment</CardTitle>
          <CardDescription>
            Enrich accounts with missing firmographic data (employee count, revenue, industry, geography)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <div>
                    <p className="font-medium capitalize">{activeJob.status}</p>
                    <p className="text-sm text-muted-foreground">
                      Provider: {activeJob.provider}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{getProgress()}%</p>
                  <p className="text-sm text-muted-foreground">Complete</p>
                </div>
              </div>

              {activeJob.error_message && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Enrichment Error:</p>
                    <p className="mt-1 text-sm">{activeJob.error_message}</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2"
                      onClick={() => {
                        window.open(
                          `https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/${activeJob.provider === 'smart' ? 'smart-enrich' : 'enrich-accounts'}/logs`,
                          '_blank'
                        );
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Edge Function Logs
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Progress value={getProgress()} className="h-2" />

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Enriched:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {activeJob.enriched_records}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Failed:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {activeJob.failed_records}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="ml-2 font-medium">
                    {activeJob.processed_records > 0
                      ? Math.round((activeJob.enriched_records / activeJob.processed_records) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Batch Size</label>
                  <Select value={batchSize} onValueChange={setBatchSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 accounts</SelectItem>
                      <SelectItem value="100">100 accounts</SelectItem>
                      <SelectItem value="250">250 accounts</SelectItem>
                      <SelectItem value="500">500 accounts</SelectItem>
                      <SelectItem value="1000">1,000 accounts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider Strategy</label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smart">Smart (PDL → Clearbit → AI)</SelectItem>
                      <SelectItem value="pdl">People Data Labs Only</SelectItem>
                      <SelectItem value="clearbit">Clearbit Only</SelectItem>
                      <SelectItem value="ai">AI Estimation Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact Discovery Toggle */}
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <UserSearch className="h-5 w-5 text-primary" />
                  <div>
                    <Label htmlFor="account-contact-discovery" className="font-medium">
                      Discover Contacts at High-Fit Accounts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-find decision-makers at accounts with fit score ≥70
                    </p>
                  </div>
                </div>
                <Switch
                  id="account-contact-discovery"
                  checked={enableContactDiscovery}
                  onCheckedChange={setEnableContactDiscovery}
                />
              </div>

              {enableContactDiscovery && highFitAccountsCount > 0 && (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    Will discover contacts at <strong>{highFitAccountsCount.toLocaleString()}</strong> high-fit accounts after enrichment
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    {stats?.needsEnrichment.toLocaleString() || 0} accounts need enrichment
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Missing employee count, revenue, industry, or country
                  </p>
                </div>
                <Button
                  onClick={startEnrichment}
                  disabled={enriching || !stats?.needsEnrichment}
                  className="gap-2"
                >
                  {enriching && <Loader2 className="h-4 w-4 animate-spin" />}
                  Start Enrichment
                </Button>
              </div>

              <Alert>
                <AlertDescription>
                  <p className="text-sm">
                    <strong>Smart Enrichment Strategy:</strong> Tries PDL first (most accurate), falls back to Clearbit Free API, 
                    then uses AI estimation if both fail. This maximizes data quality while managing costs.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
