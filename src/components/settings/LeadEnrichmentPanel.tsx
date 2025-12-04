import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Users, PlayCircle, CheckCircle, AlertCircle, 
  RefreshCw, Bot, Target, Sparkles, Search, ShieldCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Lead {
  id: number;
  name: string;
  email: string;
  title: string;
  company: string;
  account_external_id: string | null;
}

interface EnrichmentRow {
  id: string;
  record_id: string;
  status: string;
  current_agent: string | null;
  overall_score: number | null;
  confidence: string | null;
  icp_pass: boolean | null;
  icp_fail_reasons: string[] | null;
  error_message: string | null;
  search_agent_completed_at: string | null;
  validation_agent_completed_at: string | null;
  icp_agent_completed_at: string | null;
}

interface EnrichmentJob {
  id: string;
  status: string;
  total_records: number;
  rows_completed: number;
  rows_failed: number;
  rows_pending: number;
}

export function LeadEnrichmentPanel() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [activeJob, setActiveJob] = useState<EnrichmentJob | null>(null);
  const [enrichmentRows, setEnrichmentRows] = useState<EnrichmentRow[]>([]);
  const [batchSize, setBatchSize] = useState<string>("5");
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    if (!orgId) return;

    // Subscribe to enrichment_rows updates
    const channel = supabase
      .channel('enrichment-rows-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrichment_rows',
        filter: `org_id=eq.${orgId}`
      }, () => {
        loadEnrichmentRows();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrichment_jobs',
        filter: `org_id=eq.${orgId}`
      }, () => {
        loadActiveJob();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const loadLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) return;
      setOrgId(profile.org_id);

      // Get sample leads that haven't been enriched
      const { data: leadData } = await supabase
        .from('Leads')
        .select('id, name, email, title, company, account_external_id, enrichment_overall_score')
        .eq('org_id', profile.org_id)
        .is('enrichment_overall_score', null)
        .not('email', 'is', null)
        .limit(20);

      if (leadData) {
        setLeads(leadData as unknown as Lead[]);
      }

      await loadActiveJob();
      await loadEnrichmentRows();
    } catch (error: any) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveJob = async () => {
    if (!orgId) return;
    try {
      const { data: job } = await supabase
        .from('enrichment_jobs')
        .select('id, status, total_records, rows_completed, rows_failed, rows_pending')
        .eq('org_id', orgId)
        .eq('source_type', 'lead')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveJob(job);
    } catch (error) {
      console.error('Error loading active job:', error);
    }
  };

  const loadEnrichmentRows = async () => {
    if (!orgId) return;
    try {
      const { data: rows } = await supabase
        .from('enrichment_rows')
        .select('*')
        .eq('org_id', orgId)
        .eq('record_type', 'lead')
        .order('created_at', { ascending: false })
        .limit(50);

      if (rows) {
        setEnrichmentRows(rows as EnrichmentRow[]);
      }
    } catch (error) {
      console.error('Error loading enrichment rows:', error);
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

      // Get ICP profile to use for evaluation
      const { data: icpProfile } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      // Call the enrichment orchestrator
      const { data, error } = await supabase.functions.invoke('enrichment-orchestrator', {
        body: { 
          org_id: profile.org_id,
          record_type: 'lead',
          batch_size: parseInt(batchSize),
          icp_config_id: icpProfile?.id || null,
          agent_config: {
            enable_search: true,
            enable_validation: true,
            enable_icp: !!icpProfile
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Multi-Agent Enrichment Started",
        description: `Processing ${batchSize} leads through Search → Validation → ICP pipeline`,
      });

      // Refresh data
      await loadActiveJob();
      await loadEnrichmentRows();
    } catch (error: any) {
      console.error('Error starting enrichment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment",
        variant: "destructive"
      });
    } finally {
      setEnriching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      pending: { variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      processing: { variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { variant: "outline", icon: <CheckCircle className="h-3 w-3 text-green-500" /> },
      failed: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> }
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getAgentProgress = (row: EnrichmentRow) => {
    const agents = [
      { name: 'Search', completed: !!row.search_agent_completed_at, icon: <Search className="h-3 w-3" /> },
      { name: 'Validation', completed: !!row.validation_agent_completed_at, icon: <ShieldCheck className="h-3 w-3" /> },
      { name: 'ICP', completed: !!row.icp_agent_completed_at, icon: <Target className="h-3 w-3" /> }
    ];
    
    return (
      <div className="flex gap-1">
        {agents.map(agent => (
          <Badge 
            key={agent.name}
            variant={agent.completed ? "default" : "secondary"}
            className="gap-1 text-xs"
          >
            {agent.icon}
            {agent.name}
          </Badge>
        ))}
      </div>
    );
  };

  const getProgress = () => {
    if (!activeJob || !activeJob.total_records) return 0;
    return Math.round(((activeJob.rows_completed + activeJob.rows_failed) / activeJob.total_records) * 100);
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
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>Multi-Agent Lead Enrichment</CardTitle>
          </div>
          <CardDescription>
            AI-powered pipeline: Search → Validation → ICP Qualification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeJob && activeJob.status !== 'completed' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium">Processing...</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{getProgress()}%</p>
                  <p className="text-sm text-muted-foreground">
                    {activeJob.rows_completed}/{activeJob.total_records} complete
                  </p>
                </div>
              </div>
              <Progress value={getProgress()} className="h-2" />
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">✓ {activeJob.rows_completed} success</span>
                <span className="text-red-600">✗ {activeJob.rows_failed} failed</span>
                <span className="text-muted-foreground">⏳ {activeJob.rows_pending} pending</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Test Batch Size</label>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 leads (test)</SelectItem>
                    <SelectItem value="10">10 leads</SelectItem>
                    <SelectItem value="25">25 leads</SelectItem>
                    <SelectItem value="50">50 leads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={startEnrichment}
                disabled={enriching || leads.length === 0}
                className="gap-2"
              >
                {enriching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Start Multi-Agent Enrichment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sample Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Available Leads ({leads.length})</CardTitle>
              <CardDescription>Leads without enrichment data</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadLeads}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Linked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.slice(0, 10).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-mono text-sm">{lead.email}</TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>{lead.title || '-'}</TableCell>
                  <TableCell>
                    {lead.account_external_id ? (
                      <Badge variant="outline" className="text-green-600">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enrichment Results */}
      {enrichmentRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Enrichment Results</CardTitle>
                <CardDescription>Per-row status from multi-agent pipeline</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadEnrichmentRows}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent Progress</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>ICP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichmentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.record_id.slice(0, 12)}...</TableCell>
                    <TableCell>{getStatusBadge(row.status || 'pending')}</TableCell>
                    <TableCell>{getAgentProgress(row)}</TableCell>
                    <TableCell>
                      {row.overall_score !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{row.overall_score}</span>
                          <Badge variant="secondary" className="text-xs">
                            {row.confidence || 'unknown'}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.icp_pass !== null ? (
                        <Badge variant={row.icp_pass ? "default" : "destructive"}>
                          {row.icp_pass ? "PASS" : "FAIL"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {row.icp_fail_reasons && row.icp_fail_reasons.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {row.icp_fail_reasons.join(', ')}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
