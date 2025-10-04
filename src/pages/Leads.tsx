import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter, CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { DEMO_ACCOUNTS } from "@/data/mockData";
import { DemoModeBanner } from "@/components/DemoModeBanner";

interface Lead {
  id: string;
  external_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  company: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  state_province: string | null;
  status: string | null;
  account_external_id: string | null;
  contact_external_id: string | null;
  account?: {
    name: string | null;
    domain: string | null;
    industry_norm: string | null;
    employee_count: number | null;
    revenue_range: string | null;
    country: string | null;
  } | null;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
    reasons: any;
  } | null;
}

import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { LeadAccountMatcher } from "@/components/data-upload/LeadAccountMatcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, AlertTriangle } from "lucide-react";

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showMatcher, setShowMatcher] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { flags } = useFeatureFlags();

  // Pagination
  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedData,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination({ data: filteredLeads, initialPageSize: 25 });

  useEffect(() => {
    if (userProfile?.org_id) {
      loadLeads();
    }
  }, [userProfile?.org_id]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter, linkFilter]);

  const loadLeads = async () => {
    if (!userProfile?.org_id) return;
    
    setLoading(true);
    try {
      // Use demo data if demo mode is enabled
      if (flags.demo_mode) {
        const demoLeads: Lead[] = DEMO_ACCOUNTS.map(account => ({
          id: account.id,
          external_id: account.id,
          name: account.name,
          first_name: account.contacts[0]?.first_name || null,
          last_name: account.contacts[0]?.last_name || null,
          email: account.contacts[0]?.email || null,
          phone: null,
          mobile: null,
          title: account.contacts[0]?.title_raw || null,
          company: account.name,
          website: account.domain,
          industry: account.industry_norm,
          employee_count: account.employee_count,
          revenue_range: account.revenue_range,
          country: account.country,
          state_province: null,
          status: 'qualified',
          account_external_id: account.id,
          contact_external_id: account.contacts[0]?.id || null,
          account: {
            name: account.name,
            domain: account.domain,
            industry_norm: account.industry_norm,
            employee_count: account.employee_count,
            revenue_range: account.revenue_range,
            country: account.country
          },
          score: {
            overall: account.score.overall,
            fit: account.score.fit,
            intent: account.score.intent,
            reachability: account.score.reachability,
            reasons: {
              industry_match: account.score.fit > 70,
              size_match: account.score.fit > 70,
              revenue_match: account.score.fit > 70,
              geography_match: account.score.fit > 70
            }
          }
        }));
        setLeads(demoLeads);
        setLoading(false);
        return;
      }

      // Get total count of leads for display purposes
      const { count: totalCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      console.log('Leads page - Total leads in database:', totalCount);

      // Only fetch first 5000 leads to prevent memory issues
      // Use server-side pagination for better performance
      const INITIAL_LIMIT = 5000;
      const { data: leadsData, error: leadsError } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(INITIAL_LIMIT);

      if (leadsError) throw leadsError;

      console.log(`Loaded ${leadsData?.length || 0} leads of ${totalCount || 0} total`);

      // Get unique account external IDs that have a link
      const linkedAccountIds = [...new Set(
        (leadsData || [])
          .filter(lead => lead.account_external_id)
          .map(lead => lead.account_external_id)
      )];

      // Only fetch accounts and scores if we have linked accounts
      if (linkedAccountIds.length === 0) {
        // No linked accounts, just show leads without enrichment
        const simpleLeads: Lead[] = (leadsData || []).map(lead => ({
          id: lead.id?.toString() || lead.external_id,
          external_id: lead.external_id,
          name: lead.name,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          mobile: lead.mobile,
          title: lead.title,
          company: lead.company,
          website: lead.website,
          industry: lead.industry,
          employee_count: lead.employee_count,
          revenue_range: lead.revenue_range,
          country: lead.country,
          state_province: lead.state_province,
          status: lead.status,
          account_external_id: lead.account_external_id,
          contact_external_id: lead.contact_external_id,
          account: null,
          score: null
        }));
        setLeads(simpleLeads);
        return;
      }

      // Batch fetch accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('external_id, name, domain, industry_norm, employee_count, revenue_range, country')
        .eq('org_id', userProfile.org_id)
        .in('external_id', linkedAccountIds);

      if (accountsError) throw accountsError;

      // Create a Map for O(1) lookups
      const accountsMap = new Map(
        (accountsData || []).map(acc => [acc.external_id, acc])
      );

      // Batch fetch all scores for linked accounts
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('overall, fit, intent, reachability, reasons, account_external_id')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', linkedAccountIds);

      if (scoresError) throw scoresError;

      // Create a Map for scores
      const scoresMap = new Map(
        (scoresData || []).map(score => [score.account_external_id, score])
      );

      // Combine leads with their account and score data
      const enrichedLeads: Lead[] = (leadsData || []).map(lead => {
        const linkedAccount = lead.account_external_id 
          ? accountsMap.get(lead.account_external_id) 
          : null;
        
        const scoreData = lead.account_external_id 
          ? scoresMap.get(lead.account_external_id) 
          : null;

        return {
          id: lead.id?.toString() || lead.external_id,
          external_id: lead.external_id,
          name: lead.name,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          mobile: lead.mobile,
          title: lead.title,
          company: lead.company || linkedAccount?.name,
          website: lead.website || linkedAccount?.domain,
          industry: lead.industry || linkedAccount?.industry_norm,
          employee_count: lead.employee_count || linkedAccount?.employee_count,
          revenue_range: lead.revenue_range || linkedAccount?.revenue_range,
          country: lead.country || linkedAccount?.country,
          state_province: lead.state_province,
          status: lead.status,
          account_external_id: lead.account_external_id,
          contact_external_id: lead.contact_external_id,
          account: linkedAccount || null,
          score: scoreData ? {
            overall: scoreData.overall,
            fit: scoreData.fit,
            intent: scoreData.intent,
            reachability: scoreData.reachability,
            reasons: scoreData.reasons
          } : null
        };
      });

      setLeads(enrichedLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast({
        title: "Error",
        description: "Failed to load leads",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(lead => {
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
        return (
          fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.industry?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    if (linkFilter === 'linked') {
      filtered = filtered.filter(lead => lead.account_external_id);
    } else if (linkFilter === 'unlinked') {
      filtered = filtered.filter(lead => !lead.account_external_id);
    }

    setFilteredLeads(filtered);
  };

  const handleRescore = async (lead: Lead) => {
    try {
      // Call scoring API (this would be implemented later)
      const response = await fetch('/api/score/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: userProfile?.org_id,
          account_external_id: lead.external_id,
          features: {
            industry: lead.industry,
            employee_count: lead.employee_count,
            revenue_range: lead.revenue_range,
            country: lead.country
          },
          version_hint: 'v1'
        })
      });

      if (response.ok) {
        toast({ title: "Success", description: "Account rescored successfully" });
        loadLeads();
      } else {
        throw new Error('Scoring API not available');
      }
    } catch (error) {
      console.error('Error rescoring account:', error);
      toast({
        title: "Info",
        description: "Scoring API will be implemented soon",
        variant: "default"
      });
    }
  };

  const getScoreBadge = (score?: number) => {
    if (!score || score === 0) return <Badge variant="outline">Unscored</Badge>;
    if (score >= 70) return <Badge className="bg-green-500">Qualified ({score})</Badge>;
    if (score >= 40) return <Badge variant="secondary">Medium ({score})</Badge>;
    return <Badge variant="destructive">Low ({score})</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Leads</h1>
          <p className="text-muted-foreground mt-2">Manage and qualify your account pipeline</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const highSignalLeads = leads.filter(lead => (lead.score?.overall || 0) >= 70);
  const unlinkedLeads = leads.filter(lead => !lead.account_external_id);
  const linkedLeads = leads.filter(lead => lead.account_external_id);
  const unlinkedPercentage = leads.length > 0 ? Math.round((unlinkedLeads.length / leads.length) * 100) : 0;

  const exportToCSV = () => {
    if (filteredLeads.length === 0) {
      toast({
        title: "No data to export",
        description: "No leads match your current filters",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      'Lead Name',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Title',
      'Company',
      'Website',
      'Industry',
      'Employee Count',
      'Revenue Range',
      'Country',
      'State/Province',
      'Status',
      'Overall Score',
      'Fit Score',
      'Account Link',
      'External ID'
    ];

    const rows = filteredLeads.map(lead => {
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
      return [
        fullName || lead.name || '',
        lead.first_name || '',
        lead.last_name || '',
        lead.email || '',
        lead.phone || lead.mobile || '',
        lead.title || '',
        lead.company || '',
        lead.website || '',
        lead.industry || '',
        lead.employee_count || '',
        lead.revenue_range || '',
        lead.country || '',
        lead.state_province || '',
        lead.status || '',
        lead.score?.overall || '',
        lead.score?.fit || '',
        lead.account_external_id ? 'Yes' : 'No',
        lead.external_id
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${filteredLeads.length} leads to CSV`
    });
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Leads</h1>
          <p className="text-muted-foreground mt-2">All qualified accounts from your pipeline</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      {/* Unlinked Leads Alert */}
      {!flags.demo_mode && unlinkedLeads.length > 0 && unlinkedPercentage >= 50 && (
        <Alert className="border-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>{unlinkedPercentage}% of leads ({unlinkedLeads.length.toLocaleString()}) are not linked to accounts.</strong>
              <p className="text-sm mt-1">Link leads to accounts to enable ICP scoring and improve data quality.</p>
            </div>
            <Button onClick={() => setShowMatcher(true)} size="sm" className="ml-4">
              <Link2 className="h-4 w-4 mr-2" />
              Link Leads Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Lead Account Matcher */}
      {showMatcher && (
        <div>
          <LeadAccountMatcher />
          <Button variant="ghost" onClick={() => setShowMatcher(false)} className="mt-2">
            Hide Matcher
          </Button>
        </div>
      )}

      {/* Hero Metric */}
      {leads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>High-Signal Accounts</CardDescription>
              <CardTitle className="text-4xl">{highSignalLeads.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {leads.length > 0 ? Math.round((highSignalLeads.length / leads.length) * 100) : 0}% of total pipeline
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Linked to Accounts</CardDescription>
              <CardTitle className="text-4xl">{linkedLeads.length.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {leads.length > 0 ? Math.round((linkedLeads.length / leads.length) * 100) : 0}% of total leads
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Unlinked Leads</CardDescription>
              <CardTitle className="text-4xl">{unlinkedLeads.length.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Need account matching
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name, company, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="nurturing">Nurturing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={linkFilter} onValueChange={setLinkFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Account link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="linked">Linked to Account</SelectItem>
                <SelectItem value="unlinked">Unlinked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Qualified Leads ({filteredLeads.length})</CardTitle>
          <CardDescription>
            High-scoring accounts ready for outreach - Click any row to view details and ICP fit reasons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ICP Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((lead) => {
                const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || 'Unknown Lead';
                const statusVariant = 
                  lead.status === 'qualified' ? 'default' : 
                  lead.status === 'open' ? 'secondary' : 
                  'outline';
                
                return (
                  <Sheet key={lead.id}>
                    <SheetTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{fullName}</div>
                            {lead.phone && (
                              <div className="text-sm text-muted-foreground">{lead.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{lead.company || '-'}</div>
                            {lead.website && (
                              <div className="text-sm text-muted-foreground">{lead.website}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.title || '-'}</TableCell>
                        <TableCell>{lead.email || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <div>{lead.country || '-'}</div>
                            {lead.state_province && (
                              <div className="text-sm text-muted-foreground">{lead.state_province}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant}>
                            {lead.status || 'open'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.account_external_id && lead.score ? (
                            <div className="flex gap-1">
                              <Badge className="bg-success">{lead.score.overall}</Badge>
                              <Badge variant="outline" className="text-xs">
                                F: {lead.score.fit}
                              </Badge>
                            </div>
                          ) : lead.account_external_id ? (
                            <Badge variant="secondary">
                              <Link2 className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Unlinked
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    </SheetTrigger>
                    <SheetContent className="w-[600px] sm:w-[700px]">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          {fullName}
                          {lead.website && (
                            <a
                              href={`https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </SheetTitle>
                        <SheetDescription>
                          Lead Details {lead.status === 'qualified' && '- Qualified Lead'}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6 mt-6">
                      {/* Lead Information */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Lead Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Email</Label>
                            <p className="text-sm">{lead.email || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Phone</Label>
                            <p className="text-sm">{lead.phone || lead.mobile || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Title</Label>
                            <p className="text-sm">{lead.title || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Status</Label>
                            <Badge variant={statusVariant}>{lead.status || 'open'}</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Company Information */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Company Overview</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Company</Label>
                            <p className="text-sm">{lead.company || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Website</Label>
                            <p className="text-sm">{lead.website || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Industry</Label>
                            <p className="text-sm">{lead.industry || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Employees</Label>
                            <p className="text-sm">{lead.employee_count || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Revenue</Label>
                            <p className="text-sm">{lead.revenue_range || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Location</Label>
                            <p className="text-sm">{lead.country || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* ICP Fit Reasons */}
                      {lead.score && lead.account_external_id ? (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">ICP Qualification Score</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                              <span className="font-medium">Overall ICP Score:</span>
                              <Badge className="bg-success text-lg">{lead.score.overall}/100</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center p-2 border rounded">
                                <div className="text-sm text-muted-foreground">Fit</div>
                                <div className="text-xl font-bold">{lead.score.fit}</div>
                              </div>
                              <div className="text-center p-2 border rounded">
                                <div className="text-sm text-muted-foreground">Intent</div>
                                <div className="text-xl font-bold">{lead.score.intent}</div>
                              </div>
                              <div className="text-center p-2 border rounded">
                                <div className="text-sm text-muted-foreground">Reach</div>
                                <div className="text-xl font-bold">{lead.score.reachability}</div>
                              </div>
                            </div>
                            {lead.score.reasons && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Match Factors:</p>
                                <div className="space-y-1">
                                  {lead.score.reasons.industry_match && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <CheckCircle className="h-4 w-4 text-success" />
                                      <span>Industry matches ICP</span>
                                    </div>
                                  )}
                                  {lead.score.reasons.size_match && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <CheckCircle className="h-4 w-4 text-success" />
                                      <span>Company size matches ICP</span>
                                    </div>
                                  )}
                                  {lead.score.reasons.revenue_match && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <CheckCircle className="h-4 w-4 text-success" />
                                      <span>Revenue range matches ICP</span>
                                    </div>
                                  )}
                                  {lead.score.reasons.geography_match && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <CheckCircle className="h-4 w-4 text-success" />
                                      <span>Geography matches ICP</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">ICP Status</h3>
                          <Badge variant="outline">Not linked to account - No ICP score available</Badge>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="pt-4 border-t">
                        <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
                        <div className="flex flex-col gap-2">
                          <Button className="w-full justify-start">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Add to Outreach Sequence
                          </Button>
                          {lead.account_external_id && (
                            <Button variant="outline" className="w-full justify-start">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Full Account Details
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              );
            })}
            </TableBody>
          </Table>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No leads match your current filters" 
                  : "No leads found. Upload some data to get started."}
              </p>
            </div>
          )}

          {filteredLeads.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredLeads.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}