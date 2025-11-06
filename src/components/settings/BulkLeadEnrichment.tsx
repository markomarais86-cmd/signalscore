import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Mail, Briefcase, UserCheck, PlayCircle, CheckCircle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EnrichmentStats {
  total: number;
  missingEmail: number;
  missingTitle: number;
  missingPersona: number;
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
  provider: string;
}

export function BulkLeadEnrichment() {
  const { toast } = useToast();
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [activeJob, setActiveJob] = useState<EnrichmentJob | null>(null);
  const [batchSize, setBatchSize] = useState<string>("100");
  const [provider, setProvider] = useState<string>("pdl");

  useEffect(() => {
    loadStats();
    loadActiveJob();

    // Subscribe to job updates
    const channel = supabase
      .channel('enrichment-jobs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrichment_jobs',
        filter: `job_type=eq.contact_enrichment`
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

      // Get stats for leads needing enrichment
      const { data: leads } = await supabase
        .from('Leads')
        .select('email, title, persona')
        .eq('org_id', profile.org_id);

      if (leads) {
        const missingEmail = leads.filter(l => !l.email || !l.email.includes('@')).length;
        const missingTitle = leads.filter(l => !l.title || l.title === '').length;
        const missingPersona = leads.filter(l => !l.persona || l.persona === 'Unknown').length;
        
        // Leads needing enrichment are those missing any of these fields
        const needsEnrichment = leads.filter(l => 
          !l.email || !l.email.includes('@') || 
          !l.title || l.title === '' || 
          !l.persona || l.persona === 'Unknown'
        ).length;

        setStats({
          total: leads.length,
          missingEmail,
          missingTitle,
          missingPersona,
          needsEnrichment
        });
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
        .eq('job_type', 'contact_enrichment')
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
          job_type: 'contact_enrichment',
          status: 'pending',
          batch_size: parseInt(batchSize),
          total_records: stats?.needsEnrichment || 0,
          created_by: user.id
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Trigger enrichment edge function
      const { error: enrichError } = await supabase.functions.invoke('enrich-contacts-bulk', {
        body: { 
          jobId: job.id,
          batchSize: parseInt(batchSize),
          provider: provider
        }
      });

      if (enrichError) throw enrichError;

      toast({
        title: "Enrichment Started",
        description: `Processing ${stats?.needsEnrichment || 0} leads in batches of ${batchSize}`,
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
    if (!activeJob || !activeJob.total_records) return 0;
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
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missingEmail.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Title</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missingTitle.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Persona</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missingPersona.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Contact Enrichment</CardTitle>
          <CardDescription>
            Enrich contacts with missing email, title, or persona data from external providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="text-sm font-medium">
                    {activeJob.status === 'processing' ? 'Enriching contacts...' : 'Job pending...'}
                  </span>
                  <Badge variant="outline">{activeJob.provider.toUpperCase()}</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {activeJob.processed_records} / {activeJob.total_records}
                </span>
              </div>

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
                      <SelectItem value="50">50 contacts</SelectItem>
                      <SelectItem value="100">100 contacts</SelectItem>
                      <SelectItem value="250">250 contacts</SelectItem>
                      <SelectItem value="500">500 contacts</SelectItem>
                      <SelectItem value="1000">1,000 contacts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider</label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdl">People Data Labs</SelectItem>
                      <SelectItem value="clearbit">Clearbit</SelectItem>
                      <SelectItem value="ai">AI Estimation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    {stats?.needsEnrichment.toLocaleString() || 0} contacts need enrichment
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Missing email, title, or persona data
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
