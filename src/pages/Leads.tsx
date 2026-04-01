import { useState, useEffect, useCallback, useMemo } from "react";
import { WelcomeEmptyState } from "@/components/onboarding/WelcomeEmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp, Download, Info, Linkedin, AlertCircle, HelpCircle, Target, Sparkles, Phone, Mail } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/utils/format-numbers";
import { useAuth } from "@/hooks/use-auth";
import { useDataOrgId } from "@/hooks/use-data-org";
import { useToast } from "@/hooks/use-toast";
import { leadsLogger } from "@/lib/logger";
import { Label } from "@/components/ui/label";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { DEMO_ACCOUNTS } from "@/data/mockData";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { EnrichedLeadsFilters } from "@/components/leads/EnrichedLeadsFilters";
import { EnrichedLeadsTable } from "@/components/leads/EnrichedLeadsTable";
import { EnrichedLeadsHeader } from "@/components/leads/EnrichedLeadsHeader";
import { useEnrichedLeads, useEnrichedLeadsMetrics, EnrichedLead } from "@/hooks/use-enriched-leads";
import { MultiPhoneDisplay } from "@/components/leads/MultiPhoneDisplay";

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
  persona: string | null;
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
  // Enrichment fields
  icp_qualified: boolean | null;
  icp_fail_reasons: string[] | null;
  enrichment_overall_score: number | null;
  enrichment_field_scores: Record<string, number> | null;
  linkedin_url: string | null;
  still_at_company: string | null;
  direct_phone: string | null;
  enriched_at: string | null;
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

import { useInfiniteLeads } from "@/hooks/use-infinite-leads";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useLeadsMetrics } from "@/hooks/use-leads-metrics";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { LeadAccountMatcher } from "@/components/data-upload/LeadAccountMatcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, AlertTriangle, Users } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";

export default function Leads() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [personaFilter, setPersonaFilter] = useState("all");
  const [campaignReadyFilter, setCampaignReadyFilter] = useState("all");
  const [icpFilter, setIcpFilter] = useState("all");
  const [staleDaysFilter, setStaleDaysFilter] = useState<number | undefined>(undefined);
  const [showMatcher, setShowMatcher] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [hasAttemptedMatch, setHasAttemptedMatch] = useState(false);
  const [activeView, setActiveView] = useState<'all' | 'enriched'>('all');
  const { userProfile } = useAuth();
  const { dataOrgId: effectiveOrgId } = useDataOrgId();
  const { toast } = useToast();
  const { flags } = useFeatureFlags();

  // Enriched view state
  const [enrichedSearchTerm, setEnrichedSearchTerm] = useState("");
  const [enrichmentSource, setEnrichmentSource] = useState("all");
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low' | 'all'>('all');
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [hasPhone, setHasPhone] = useState<boolean | null>(null);
  const [icpQualified, setIcpQualified] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<'name' | 'enriched_at' | 'enrichment_confidence'>('enriched_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedEnrichedIds, setSelectedEnrichedIds] = useState<Set<number>>(new Set());
  const [detailLead, setDetailLead] = useState<EnrichedLead | null>(null);

  // Sync URL params to sidebar filters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campaignReady = params.get('campaign_ready');
    const source = params.get('source');
    const status = params.get('status');
    const icp = params.get('icp');
    const staleDays = params.get('stale_days');
    const view = params.get('view');
    
    if (campaignReady === 'true') setCampaignReadyFilter('ready');
    if (source) setLinkFilter(source === 'crm' ? 'linked' : source);
    if (status) setStatusFilter(status);
    if (icp === 'qualified') setIcpFilter('qualified');
    if (staleDays) setStaleDaysFilter(parseInt(staleDays, 10));
    if (view === 'enriched') setActiveView('enriched');
  }, []);

  // Use infinite scroll hook
  const {
    leads,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    retry,
    lastError
  } = useInfiniteLeads({
    orgId: effectiveOrgId || null,
    pageSize: 25,
    searchTerm,
    statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
    linkFilter: linkFilter !== 'all' ? linkFilter : undefined,
    personaFilter: personaFilter !== 'all' ? personaFilter : undefined,
    campaignReadyFilter: campaignReadyFilter !== 'all' ? campaignReadyFilter : undefined,
    icpFilter: icpFilter !== 'all' ? icpFilter : undefined,
    staleDaysFilter
  });

  // Fetch database-level metrics (accurate counts across all 63k+ leads)
  const { data: metrics, isLoading: metricsLoading } = useLeadsMetrics(effectiveOrgId);

  // Enriched leads data (for enriched tab)
  const {
    leads: enrichedLeads,
    isLoading: enrichedLoading,
    isLoadingMore: enrichedLoadingMore,
    hasMore: enrichedHasMore,
    totalCount: enrichedTotalCount,
    loadMore: enrichedLoadMore,
    refresh: enrichedRefresh
  } = useEnrichedLeads({
    orgId: effectiveOrgId || null,
    searchTerm: enrichedSearchTerm,
    enrichmentSource,
    confidenceLevel,
    dateRange,
    hasPhone,
    icpQualified,
    sortField,
    sortDirection
  });

  const enrichedMetrics = useEnrichedLeadsMetrics(effectiveOrgId || null);

  // Set up infinite scroll observer
  const { observerTarget } = useInfiniteScroll({
    onLoadMore: activeView === 'all' ? loadMore : enrichedLoadMore,
    hasMore: activeView === 'all' ? hasMore : enrichedHasMore,
    isLoading: activeView === 'all' ? isLoadingMore : enrichedLoadingMore
  });

  // Enriched view handlers
  const handleEnrichedSort = (field: 'name' | 'enriched_at' | 'enrichment_confidence') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearEnrichedFilters = () => {
    setEnrichedSearchTerm("");
    setEnrichmentSource("all");
    setConfidenceLevel("all");
    setDateRange("all");
    setHasPhone(null);
    setIcpQualified(null);
  };

  const handleReEnrich = async (lead: EnrichedLead) => {
    if (!lead.email || !effectiveOrgId) return;
    
    try {
      await supabase.functions.invoke('enrich-unified', {
        body: { 
          org_id: effectiveOrgId, 
          leads: [{ email: lead.email, first_name: lead.first_name, last_name: lead.last_name, company: lead.company }],
          save_to_db: true
        }
      });
      toast({ title: "Re-enrichment started", description: `Processing ${lead.email}...` });
      setTimeout(enrichedRefresh, 2000);
    } catch (error) {
      toast({ title: "Failed", description: "Could not start re-enrichment", variant: "destructive" });
    }
  };

  const selectedEnrichedLeads = enrichedLeads.filter(l => selectedEnrichedIds.has(l.id));

  // Removed auto-match on page load - it causes timeouts and poor UX

  const handleAutoMatch = async () => {
    if (!effectiveOrgId) {
      toast({
        title: "Error",
        description: "No organization ID found",
        variant: "destructive",
      });
      return;
    }

    setIsMatching(true);
    
    try {
      leadsLogger.info('Starting fast SQL-based lead-to-account matching...');
      
      toast({
        title: "Matching Leads...",
        description: "This will take just a few seconds.",
      });
      
      // Call the fast SQL function directly
      const { data, error } = await supabase.rpc('match_leads_to_accounts_fast', {
        p_org_id: effectiveOrgId
      });

      if (error) {
        leadsLogger.error('SQL function error:', error);
        throw error;
      }

      leadsLogger.info('Matching result:', data);
      
      const result = data as { success: boolean; total_linked: number; matched_to_existing: number; new_accounts_created: number; failed: number };
      
      if (result.success) {
        toast({
          title: "✓ Leads Matched Successfully",
          description: `${formatNumber(result.total_linked)} leads linked (${formatNumber(result.matched_to_existing)} matched to existing accounts, ${formatNumber(result.new_accounts_created)} new accounts created)`,
        });
        
        // Reload leads to show updated data
        await refresh();
      } else {
        throw new Error('Matching failed');
      }
    } catch (error) {
      leadsLogger.error('Error matching leads:', error);
      toast({
        title: "Matching Failed",
        description: error instanceof Error ? error.message : "Could not link leads to accounts.",
        variant: "destructive",
      });
    } finally {
      setIsMatching(false);
    }
  };

  const handleRescore = async (lead: Lead) => {
    if (!lead.account_external_id) {
      toast({
        title: "Cannot rescore",
        description: "Lead must be linked to an account first",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('score-accounts', {
        body: {
          org_id: effectiveOrgId,
          account_ids: [lead.account_external_id]
        }
      });

      if (error) throw error;

      toast({ title: "Success", description: "Account rescored successfully" });
      refresh();
    } catch (error) {
      leadsLogger.error('Error rescoring account:', error);
      toast({
        title: "Scoring failed",
        description: error instanceof Error ? error.message : "Could not rescore account",
        variant: "destructive"
      });
    }
  };

  const getScoreBadge = (score?: number) => {
    if (!score || score === 0) return <Badge variant="outline">Unscored</Badge>;
    if (score >= 60) return <Badge className="bg-[hsl(var(--signal-high))] text-white">Qualified ({score})</Badge>;
    if (score >= 40) return <Badge className="bg-[hsl(var(--signal-medium))] text-black">Medium ({score})</Badge>;
    return <Badge variant="destructive">Low ({score})</Badge>;
  };

  // Memoized CSV headers - must be before early return to maintain hook order
  const csvHeaders = useMemo(() => [
    'Name',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Title',
    'Persona',
    'Campaign Ready',
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
  ], []);

  const exportToCSV = useCallback(() => {
    if (leads.length === 0) {
      toast({
        title: "No data to export",
        description: "No leads match your current filters",
        variant: "destructive"
      });
      return;
    }

    const rows = leads.map(lead => {
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
      const isCampaignReady = lead.email && lead.title && lead.persona && lead.persona !== 'Unknown';
      return [
        fullName || lead.name || '',
        lead.first_name || '',
        lead.last_name || '',
        lead.email || '',
        lead.phone || lead.mobile || '',
        lead.title || '',
        lead.persona || '',
        isCampaignReady ? 'Yes' : 'No',
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
      csvHeaders.join(','),
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
      description: `Exported ${leads.length} leads to CSV`
    });
  }, [leads, csvHeaders, toast]);

  // Parse phones for detail view
  const getPhonesList = (lead: EnrichedLead) => {
    const phones: any[] = [];
    if (lead.direct_phone) phones.push({ number: lead.direct_phone, type: 'direct', sources: ['enrichment'], confidence: 90 });
    if (lead.phone) phones.push({ number: lead.phone, type: 'office', sources: ['import'], confidence: 70 });
    if (lead.mobile) phones.push({ number: lead.mobile, type: 'mobile', sources: ['import'], confidence: 70 });
    if (lead.phones) {
      try {
        const data = typeof lead.phones === 'string' ? JSON.parse(lead.phones) : lead.phones;
        if (Array.isArray(data)) phones.push(...data);
      } catch {}
    }
    return phones;
  };

  if ((isLoading && leads.length === 0) || isMatching) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold leading-tight">Leads</h1>
          <p className="text-xs lg:text-sm text-muted-foreground mt-1">All people linked to accounts in your pipeline</p>
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // Use database metrics for accurate totals, fall back to local counts for visible leads
  const icpQualifiedCount = metrics?.icp_qualified_count ?? 0;
  const campaignReadyCount = metrics?.campaign_ready_count ?? 0;
  const enrichedCount = metrics?.enriched_count ?? 0;
  const linkedCount = metrics?.linked_to_accounts_count ?? 0;
  const totalLeadsCount = metrics?.total_leads ?? 0;

  // Local counts from visible leads (for unlinked alert)
  const unlinkedLeads = leads.filter(lead => !lead.account_external_id);
  const unlinkedPercentage = totalLeadsCount > 0 ? Math.round(((totalLeadsCount - linkedCount) / totalLeadsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <DemoModeBanner />
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-semibold leading-tight">Leads</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p><strong>Leads</strong> are individual contacts at your accounts. They're automatically matched to accounts by domain or company name when uploaded.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs lg:text-sm text-muted-foreground mt-1">All people linked to accounts in your pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          {activeView === 'all' && (
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'all' | 'enriched')} className="w-full">
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Leads
            <Badge variant="secondary" className="ml-1">{formatNumber(totalCount)}</Badge>
          </TabsTrigger>
          <TabsTrigger value="enriched" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Enriched
            <Badge variant="secondary" className="ml-1">{formatNumber(enrichedTotalCount)}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* All Leads View */}
      {activeView === 'all' && (
        <>
          {/* Info: Leads auto-match on upload */}
          {!flags.demo_mode && unlinkedLeads.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <div>
                  <strong>Note:</strong> You have {formatNumber(unlinkedLeads.length)} leads without account links.
                </div>
                <div className="text-sm">
                  <p>Leads are automatically matched to accounts when uploaded via CSV. These unlinked leads may be from older uploads.</p>
                </div>
                <Button
                  onClick={handleAutoMatch}
                  disabled={isMatching}
                  size="sm"
                >
                  {isMatching ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                      Matching...
                    </>
                  ) : (
                    'Link to Accounts'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Unlinked Leads Alert */}
          {!flags.demo_mode && unlinkedLeads.length > 0 && unlinkedPercentage >= 10 && hasAttemptedMatch && (
            <Alert className="border-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <strong>{formatNumber(unlinkedLeads.length)} leads still unlinked after auto-matching.</strong>
                  <p className="text-sm mt-1">These leads may be missing email/website data needed for account matching.</p>
                </div>
                <Button onClick={handleAutoMatch} size="sm" className="ml-4" disabled={isMatching}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Retry Matching
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

          {/* Hero Metrics - Using database totals with HeroMetric for consistency */}
          {(totalLeadsCount > 0 || metricsLoading) && (
            <div className="grid gap-4 md:grid-cols-4">
              <HeroMetric
                label="ICP Qualified"
                value={metricsLoading ? "..." : formatNumber(icpQualifiedCount)}
                subtitle={`${totalLeadsCount > 0 ? Math.round((icpQualifiedCount / totalLeadsCount) * 100) : 0}% of ${formatNumber(totalLeadsCount)} leads`}
                icon={CheckCircle}
                status="success"
              />
              <HeroMetric
                label="Campaign Ready"
                value={metricsLoading ? "..." : formatNumber(campaignReadyCount)}
                subtitle="Has email, title & persona"
                icon={Target}
              />
              <HeroMetric
                label="Enriched"
                value={metricsLoading ? "..." : formatNumber(enrichedCount)}
                subtitle={`${totalLeadsCount > 0 ? Math.round((enrichedCount / totalLeadsCount) * 100) : 0}% processed`}
                icon={TrendingUp}
              />
              <HeroMetric
                label="Linked to Accounts"
                value={metricsLoading ? "..." : formatNumber(linkedCount)}
                subtitle={`${totalLeadsCount > 0 ? Math.round((linkedCount / totalLeadsCount) * 100) : 0}% of all leads`}
                icon={ExternalLink}
              />
            </div>
          )}

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter & Search</CardTitle>
          <CardDescription>
            <strong>Campaign Ready</strong> = Contact has email, title, and persona (not Unknown)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
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
            <Select value={personaFilter} onValueChange={setPersonaFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by persona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Personas</SelectItem>
                <SelectItem value="Technical Decision Maker">Technical Decision Maker</SelectItem>
                <SelectItem value="Business Decision Maker">Business Decision Maker</SelectItem>
                <SelectItem value="IT Decision Maker">IT Decision Maker</SelectItem>
                <SelectItem value="Technical Influencer">Technical Influencer</SelectItem>
                <SelectItem value="Business Influencer">Business Influencer</SelectItem>
                <SelectItem value="End User">End User</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignReadyFilter} onValueChange={setCampaignReadyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Campaign ready" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="ready">Campaign Ready</SelectItem>
                <SelectItem value="not_ready">Not Ready</SelectItem>
              </SelectContent>
            </Select>
            <Select value={icpFilter} onValueChange={setIcpFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="ICP Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ICP Status</SelectItem>
                <SelectItem value="qualified">ICP Qualified</SelectItem>
                <SelectItem value="failed">ICP Failed</SelectItem>
                <SelectItem value="not_enriched">Not Enriched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>People ({formatNumber(totalCount)})</CardTitle>
          <CardDescription>
            All contacts linked to accounts - Use filters to find campaign-ready leads with email, title, and persona data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>ICP Status</TableHead>
                <TableHead>Enrichment</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Campaign Ready</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
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
                        <TableCell>
                          {lead.persona && lead.persona !== 'Unknown' ? (
                            <Badge variant={
                              lead.persona.includes('Decision Maker') ? 'default' :
                              lead.persona.includes('Influencer') ? 'secondary' :
                              'outline'
                            }>
                              {lead.persona}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            {lead.enriched_at ? (
                              lead.icp_qualified === true ? (
                                <Badge className="bg-[hsl(var(--signal-high))]">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  ICP Qualified
                                </Badge>
                              ) : lead.icp_qualified === false ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="destructive" className="cursor-help">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      ICP Failed
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-medium mb-1">Fail Reasons:</p>
                                    <ul className="text-xs space-y-1">
                                      {(lead.icp_fail_reasons || []).map((reason, i) => (
                                        <li key={i}>• {reason}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Not Enriched
                              </Badge>
                            )}
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {lead.enrichment_overall_score !== null ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${
                                lead.enrichment_overall_score >= 15 ? 'text-[hsl(var(--signal-high))]' :
                                lead.enrichment_overall_score >= 10 ? 'text-[hsl(var(--signal-medium))]' :
                                'text-[hsl(var(--signal-low))]'
                              }`}>
                                {lead.enrichment_overall_score}/20
                              </span>
                              {lead.linkedin_url && (
                                <a
                                  href={lead.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#0077b5] hover:text-[#005885]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Linkedin className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{lead.country || '-'}</div>
                            {lead.state_province && (
                              <div className="text-sm text-muted-foreground">{lead.state_province}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.email && lead.title && lead.persona && lead.persona !== 'Unknown' ? (
                            <Badge className="bg-[hsl(var(--signal-high))]">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <XCircle className="h-3 w-3 mr-1" />
                              Incomplete
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:w-[540px] md:w-[640px] overflow-y-auto">
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

                    <div className="space-y-6 mt-6 pb-6">
                      {/* Lead Information */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Lead Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Email</Label>
                            <p className="text-sm break-all">{lead.email || '-'}</p>
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
                            <Label className="text-sm font-medium">Persona</Label>
                            <div>
                              {lead.persona && lead.persona !== 'Unknown' ? (
                                <Badge variant={
                                  lead.persona.includes('Decision Maker') ? 'default' :
                                  lead.persona.includes('Influencer') ? 'secondary' :
                                  'outline'
                                }>
                                  {lead.persona}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </div>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Company</Label>
                            <p className="text-sm truncate">{lead.company || '-'}</p>
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

                      {/* Enrichment Data */}
                      {lead.enriched_at && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <LaunchPulseMark className="h-5 w-5" />
                            Enrichment Data
                          </h3>
                          <div className="space-y-4">
                            {/* ICP Status */}
                            <div className={`p-3 rounded-lg border ${
                              lead.icp_qualified === true ? 'bg-[hsl(var(--signal-high))]/10 border-[hsl(var(--signal-high))]/30' :
                              lead.icp_qualified === false ? 'bg-destructive/10 border-destructive/30' :
                              'bg-muted'
                            }`}>
                              <div className="flex justify-between items-center">
                                <span className="font-medium">ICP Qualification:</span>
                                {lead.icp_qualified === true ? (
                                  <Badge className="bg-[hsl(var(--signal-high))]">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Qualified
                                  </Badge>
                                ) : lead.icp_qualified === false ? (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Qualified
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </div>
                              {lead.icp_fail_reasons && lead.icp_fail_reasons.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-destructive/20">
                                  <p className="text-sm text-muted-foreground mb-1">Fail Reasons:</p>
                                  <ul className="text-sm space-y-1">
                                    {lead.icp_fail_reasons.map((reason, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                        <span>{reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Enrichment Quality Score */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium">Quality Score</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-2xl font-bold ${
                                    (lead.enrichment_overall_score || 0) >= 15 ? 'text-[hsl(var(--signal-high))]' :
                                    (lead.enrichment_overall_score || 0) >= 10 ? 'text-[hsl(var(--signal-medium))]' :
                                    'text-[hsl(var(--signal-low))]'
                                  }`}>
                                    {lead.enrichment_overall_score || 0}/20
                                  </span>
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Still at Company</Label>
                                <p className="text-sm mt-1">
                                  {lead.still_at_company === 'yes' ? (
                                    <Badge className="bg-[hsl(var(--signal-high))]">Confirmed</Badge>
                                  ) : lead.still_at_company === 'no' ? (
                                    <Badge variant="destructive">Left Company</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">Unknown</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* LinkedIn & Direct Phone */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium">LinkedIn</Label>
                                {lead.linkedin_url ? (
                                  <a
                                    href={lead.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-[#0077b5] hover:underline mt-1"
                                  >
                                    <Linkedin className="h-4 w-4" />
                                    View Profile
                                  </a>
                                ) : (
                                  <p className="text-sm text-muted-foreground mt-1">-</p>
                                )}
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Direct Phone</Label>
                                <p className="text-sm mt-1">{lead.direct_phone || '-'}</p>
                              </div>
                            </div>

                            {/* Field Scores */}
                            {lead.enrichment_field_scores && Object.keys(lead.enrichment_field_scores).length > 0 && (
                              <div>
                                <Label className="text-sm font-medium mb-2 block">Field Quality Scores</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(lead.enrichment_field_scores).map(([field, score]) => (
                                    <div key={field} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                                      <span className="capitalize">{field.replace(/_/g, ' ')}</span>
                                      <span className={`font-medium ${
                                        (score as number) >= 3 ? 'text-[hsl(var(--signal-high))]' :
                                        (score as number) >= 2 ? 'text-[hsl(var(--signal-medium))]' :
                                        'text-[hsl(var(--signal-low))]'
                                      }`}>
                                        {score as number}/5
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Legacy ICP Fit Reasons for account-linked leads without enrichment */}
                      {!lead.enriched_at && lead.score && lead.account_external_id && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">ICP Qualification Score</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-[hsl(var(--signal-high))]/10 rounded-lg">
                              <span className="font-medium">Overall ICP Score:</span>
                              <Badge className="bg-[hsl(var(--signal-high))] text-lg">{lead.score.overall}/100</Badge>
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
                          </div>
                        </div>
                      )}

                      {/* Not enriched message */}
                      {!lead.enriched_at && !lead.score && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">ICP Status</h3>
                          <div className="p-4 bg-muted rounded-lg text-center">
                            <LaunchPulseMark className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              This lead has not been enriched yet. Run lead enrichment to get ICP qualification and quality scores.
                            </p>
                          </div>
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

          {/* Infinite Scroll Trigger */}
          <InfiniteScrollTrigger
            observerTarget={observerTarget}
            isLoading={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onRetry={retry}
            error={lastError}
            itemsCount={leads.length}
            totalCount={totalCount}
          />

          {leads.length === 0 && !isLoading && (
            <div className="py-6">
              {searchTerm || statusFilter !== "all" ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No leads match your current filters</p>
                </div>
              ) : (
                <WelcomeEmptyState highlightStep="upload_data" compact />
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Enriched Leads View */}
      {activeView === 'enriched' && (
        <>
          {/* Enriched Hero Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <HeroMetric
              label="Total Enriched"
              value={enrichedMetrics.isLoading ? "..." : formatNumber(enrichedMetrics.totalEnriched)}
              icon={Sparkles}
            />
            <HeroMetric
              label="High Confidence"
              value={enrichedMetrics.isLoading ? "..." : formatNumber(enrichedMetrics.highConfidence)}
              subtitle="80%+ confidence score"
              icon={TrendingUp}
              status="success"
            />
            <HeroMetric
              label="Phone Discovered"
              value={enrichedMetrics.isLoading ? "..." : formatNumber(enrichedMetrics.phoneDiscovered)}
              icon={Phone}
            />
            <HeroMetric
              label="Email Verified"
              value={enrichedMetrics.isLoading ? "..." : formatNumber(enrichedMetrics.emailVerified)}
              icon={Mail}
              status="success"
            />
          </div>

          {/* Enriched Filters */}
          <EnrichedLeadsFilters
            searchTerm={enrichedSearchTerm}
            onSearchChange={setEnrichedSearchTerm}
            enrichmentSource={enrichmentSource}
            onEnrichmentSourceChange={setEnrichmentSource}
            confidenceLevel={confidenceLevel}
            onConfidenceLevelChange={setConfidenceLevel}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            hasPhone={hasPhone}
            onHasPhoneChange={setHasPhone}
            icpQualified={icpQualified}
            onIcpQualifiedChange={setIcpQualified}
            onClearFilters={clearEnrichedFilters}
          />

          {/* Enriched Header with bulk actions */}
          <EnrichedLeadsHeader
            selectedLeads={selectedEnrichedLeads}
            allLeads={enrichedLeads}
            orgId={effectiveOrgId || null}
            onRefresh={enrichedRefresh}
            onClearSelection={() => setSelectedEnrichedIds(new Set())}
          />

          {/* Enriched Table */}
          <EnrichedLeadsTable
            leads={enrichedLeads}
            selectedIds={selectedEnrichedIds}
            onSelectionChange={setSelectedEnrichedIds}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleEnrichedSort}
            isLoading={enrichedLoading}
            isLoadingMore={enrichedLoadingMore}
            hasMore={enrichedHasMore}
            onLoadMore={enrichedLoadMore}
            onReEnrich={handleReEnrich}
            onViewDetails={setDetailLead}
          />

          {/* Enriched Lead Detail Sheet */}
          <Sheet open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
            <SheetContent className="w-[400px] sm:w-[540px]">
              {detailLead && (
                <>
                  <SheetHeader>
                    <SheetTitle>{detailLead.first_name} {detailLead.last_name}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Title</p>
                        <p className="font-medium">{detailLead.title || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Level</p>
                        <p className="font-medium">{detailLead.level || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Persona</p>
                        <p className="font-medium">{detailLead.persona || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="font-medium">{detailLead.company || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{detailLead.email || '-'}</p>
                        {detailLead.email_verified && <Badge variant="secondary">Verified</Badge>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Phone Numbers</p>
                      <MultiPhoneDisplay phones={getPhonesList(detailLead)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Enrichment Confidence</p>
                        <p className="font-medium">{detailLead.enrichment_confidence !== null && detailLead.enrichment_confidence !== undefined ? `${Math.round(detailLead.enrichment_confidence)}%` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Enrichment Source</p>
                        <p className="font-medium capitalize">{detailLead.enrichment_source || detailLead.enriched_from || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}