import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, CheckCircle, FileSpreadsheet, AlertCircle } from "lucide-react";

interface ExportStats {
  totalAccounts: number;
  totalLeads: number;
  leadsWithEmail: number;
  leadsWithTitle: number;
  leadsWithPersona: number;
  campaignReady: number;
}

export function TestExportPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [exportResult, setExportResult] = useState<{ success: boolean; count: number } | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      // Get high-fit accounts
      const { data: scores } = await supabase
        .from('scores')
        .select('account_external_id')
        .eq('org_id', profile.org_id)
        .gte('overall', 70);

      const highFitAccountIds = scores?.map(s => s.account_external_id) || [];

      // Get leads for these accounts
      const { data: leads } = await supabase
        .from('Leads')
        .select('id, email, title, persona, account_external_id')
        .eq('org_id', profile.org_id)
        .in('account_external_id', highFitAccountIds.length > 0 ? highFitAccountIds : ['__none__']);

      if (leads) {
        const leadsWithEmail = leads.filter(l => l.email && l.email.includes('@')).length;
        const leadsWithTitle = leads.filter(l => l.title && l.title !== '').length;
        const leadsWithPersona = leads.filter(l => l.persona && l.persona !== 'Unknown').length;
        const campaignReady = leads.filter(l => 
          l.email && l.email.includes('@') && 
          l.title && l.title !== '' && 
          l.persona && l.persona !== 'Unknown'
        ).length;

        setStats({
          totalAccounts: highFitAccountIds.length,
          totalLeads: leads.length,
          leadsWithEmail,
          leadsWithTitle,
          leadsWithPersona,
          campaignReady
        });
      }
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast({
        title: "Error",
        description: "Failed to load export statistics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runTestExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      // Get high-fit accounts with scores
      const { data: scores } = await supabase
        .from('scores')
        .select('account_external_id, overall, fit, intent, reachability')
        .eq('org_id', profile.org_id)
        .gte('overall', 70)
        .limit(100);

      const highFitAccountIds = scores?.map(s => s.account_external_id) || [];

      if (highFitAccountIds.length === 0) {
        setExportResult({ success: false, count: 0 });
        toast({
          title: "No High-Fit Accounts",
          description: "No accounts with score >= 70 found",
          variant: "destructive"
        });
        return;
      }

      // Get campaign-ready leads
      const { data: leads } = await supabase
        .from('Leads')
        .select(`
          id, first_name, last_name, name, email, title, persona, phone,
          linkedin_url, company, account_external_id, country,
          enrichment_field_scores, enrichment_overall_score, icp_qualified, enrichment_source
        `)
        .eq('org_id', profile.org_id)
        .in('account_external_id', highFitAccountIds)
        .not('email', 'is', null)
        .limit(100);

      // Get account data
      const { data: accounts } = await supabase
        .from('accounts')
        .select('external_id, name, domain, industry_norm, employee_count, revenue_range, country, enrichment_field_scores, icp_qualified')
        .eq('org_id', profile.org_id)
        .in('external_id', highFitAccountIds);

      const accountMap = new Map(accounts?.map(a => [a.external_id, a]) || []);
      const scoreMap = new Map(scores?.map(s => [s.account_external_id, s]) || []);

      if (!leads || leads.length === 0) {
        setExportResult({ success: false, count: 0 });
        toast({
          title: "No Leads Found",
          description: "No leads with email found at high-fit accounts",
          variant: "destructive"
        });
        return;
      }

      // Generate CSV with all enrichment fields
      const headers = [
        'First Name', 'Last Name', 'Email', 'Title', 'Persona', 'Phone', 'LinkedIn',
        'Company', 'Domain', 'Industry', 'Employee Count', 'Revenue Range', 'Country',
        'Fit Score', 'Intent Score', 'Reachability', 'Overall Score',
        'ICP Qualified', 'Enrichment Source', 'Lead Field Scores', 'Account Field Scores'
      ];

      const rows = leads.map(lead => {
        const account = accountMap.get(lead.account_external_id || '');
        const score = scoreMap.get(lead.account_external_id || '');
        
        return [
          lead.first_name || '',
          lead.last_name || '',
          lead.email || '',
          lead.title || '',
          lead.persona || '',
          lead.phone || '',
          lead.linkedin_url || '',
          lead.company || account?.name || '',
          account?.domain || '',
          account?.industry_norm || '',
          account?.employee_count || '',
          account?.revenue_range || '',
          lead.country || account?.country || '',
          score?.fit || '',
          score?.intent || '',
          score?.reachability || '',
          score?.overall || '',
          lead.icp_qualified ? 'Yes' : (account?.icp_qualified ? 'Yes' : 'No'),
          lead.enrichment_source || '',
          lead.enrichment_field_scores ? JSON.stringify(lead.enrichment_field_scores) : '',
          account?.enrichment_field_scores ? JSON.stringify(account.enrichment_field_scores) : ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Record export in campaign_snapshots
      await supabase
        .from('campaign_snapshots')
        .insert({
          org_id: profile.org_id,
          icp_name: 'Test Export',
          export_type: 'csv',
          total_accounts: highFitAccountIds.length,
          total_contacts: leads.length,
          campaign_ready_contacts: leads.length,
          sync_status: 'completed'
        });

      setExportResult({ success: true, count: leads.length });
      toast({
        title: "Test Export Complete",
        description: `Exported ${leads.length} leads with all enrichment fields`
      });
    } catch (error: any) {
      console.error('Error exporting:', error);
      setExportResult({ success: false, count: 0 });
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export leads",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Flow Testing
        </CardTitle>
        <CardDescription>
          Verify the campaign export flow works correctly with all enrichment data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats ? (
          <Button onClick={loadStats} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Check Export Readiness
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{stats.totalAccounts.toLocaleString()}</div>
                <div className="text-muted-foreground">High-Fit Accounts</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{stats.totalLeads.toLocaleString()}</div>
                <div className="text-muted-foreground">Total Leads</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.campaignReady.toLocaleString()}</div>
                <div className="text-muted-foreground">Campaign Ready</div>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>With Email:</span>
                <span className={stats.leadsWithEmail === stats.totalLeads ? 'text-green-600' : 'text-yellow-600'}>
                  {stats.leadsWithEmail.toLocaleString()} / {stats.totalLeads.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>With Title:</span>
                <span className={stats.leadsWithTitle === stats.totalLeads ? 'text-green-600' : 'text-yellow-600'}>
                  {stats.leadsWithTitle.toLocaleString()} / {stats.totalLeads.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>With Persona:</span>
                <span className={stats.leadsWithPersona === stats.totalLeads ? 'text-green-600' : 'text-yellow-600'}>
                  {stats.leadsWithPersona.toLocaleString()} / {stats.totalLeads.toLocaleString()}
                </span>
              </div>
            </div>

            {exportResult && (
              <Alert variant={exportResult.success ? 'default' : 'destructive'}>
                {exportResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  {exportResult.success 
                    ? `Successfully exported ${exportResult.count} leads with all enrichment fields`
                    : 'Export failed - no leads found matching criteria'
                  }
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={runTestExport} 
                disabled={exporting || stats.totalLeads === 0}
                className="gap-2"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Run Test Export (100 leads)
              </Button>
              <Button variant="outline" onClick={loadStats} disabled={loading}>
                Refresh Stats
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}