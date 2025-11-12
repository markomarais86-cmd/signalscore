import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/utils/format-numbers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Database, ExternalLink, AlertCircle, CheckCircle2, Download, TrendingUp, Sparkles, X, Filter, Target, Edit, ChevronDown, Building2, Globe, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Progress } from "@/components/ui/progress";
import { ScoreBreakdownDialog } from "@/components/scoring/ScoreBreakdownDialog";
import { AccountDetailDrawer } from "@/components/accounts/AccountDetailDrawer";
import { BulkScoring } from "@/components/BulkScoring";
import { CorrelationInsights } from "@/components/CorrelationInsights";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { getSourceLabel, getSourceBadgeVariant } from "@/utils/data-source-attribution";
import { EmptyDataState } from "@/components/EmptyDataState";
import { PRIMARY_INDUSTRIES, SUB_INDUSTRIES_MAP } from "@/constants/zoominfo-industries";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useInfiniteAccounts } from "@/hooks/use-infinite-accounts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";

interface Account {
  id: string;
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  updated_at: string;
  data_source?: 'crm' | 'database' | 'both';
  external_database_match?: boolean;
  enriched_from?: string | null;
  enriched_at?: string | null;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
  } | null;
  contacts?: number;
}

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const icpContext = location.state as {
    icpId?: string;
    icpName?: string;
    prefilters?: {
      industries?: string[];
      geographies?: string[];
      companySizes?: number[];
      revenueRanges?: string[];
    };
  } | null;
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [subIndustryFilter, setSubIndustryFilter] = useState("all");
  
  // ICP-specific filter states
  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [icpGeographies, setIcpGeographies] = useState<string[]>([]);
  const [icpSizes, setIcpSizes] = useState<number[]>([]);
  const [icpRevenues, setIcpRevenues] = useState<string[]>([]);
  const [selectedAccountForScore, setSelectedAccountForScore] = useState<Account | null>(null);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [enrichingSingleAccount, setEnrichingSingleAccount] = useState<string | null>(null);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [hasActiveICP, setHasActiveICP] = useState(false);
  const [needsScoring, setNeedsScoring] = useState(false);
  const [icpDetailsOpen, setIcpDetailsOpen] = useState(true);
  
  // URL-based filters
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [fitFilter, setFitFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [icpFilter, setIcpFilter] = useState<string | null>(null);
  const [campaignReadyFilter, setCampaignReadyFilter] = useState<boolean | null>(null);
  
  const [totalAccountsForSummary, setTotalAccountsForSummary] = useState(0);
  const [summaryStats, setSummaryStats] = useState({
    withContacts: 0,
    avgQuality: 0,
    highFit: 0,
    crmAccounts: 0,
    databaseAccounts: 0
  });
  
  // Unfiltered org-wide totals (always matches Dashboard)
  const [unfilteredTotals, setUnfilteredTotals] = useState({
    total: 0,
    crm: 0,
    database: 0,
    highFit: 0,
    withLeads: 0,
    avgQuality: 0
  });
  
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();

  // Infinite scroll hook
  const {
    accounts,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    retry,
    lastError
  } = useInfiniteAccounts({
    orgId: userProfile?.org_id || null,
    pageSize: 25,
    searchTerm,
    industryFilter,
    subIndustryFilter,
    sourceFilter,
    fitFilter,
    countryFilter,
    campaignReadyFilter,
    enabled: !!userProfile?.org_id,
  });

  // Infinite scroll observer
  const { observerTarget } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore,
  });

  // Read URL parameters on mount
  useEffect(() => {
    const source = searchParams.get('source');
    const fit = searchParams.get('fit');
    const country = searchParams.get('country');
    const state = searchParams.get('state');
    const icp = searchParams.get('icp_id');
    const campaignReady = searchParams.get('campaign_ready');
    
    setSourceFilter(source);
    setFitFilter(fit);
    setCountryFilter(country);
    setStateFilter(state);
    setIcpFilter(icp);
    setCampaignReadyFilter(campaignReady === 'true');
  }, [searchParams]);

  // Pre-populate filters from ICP context - store ALL ICP criteria
  useEffect(() => {
    if (icpContext?.prefilters) {
      if (icpContext.prefilters.industries?.length > 0) {
        setIcpIndustries(icpContext.prefilters.industries);
      }
      if (icpContext.prefilters.geographies?.length > 0) {
        setIcpGeographies(icpContext.prefilters.geographies);
      }
      if (icpContext.prefilters.companySizes?.length > 0) {
        setIcpSizes(icpContext.prefilters.companySizes);
      }
      if (icpContext.prefilters.revenueRanges?.length > 0) {
        setIcpRevenues(icpContext.prefilters.revenueRanges);
      }
    }
  }, [icpContext]);

  const clearICPContext = () => {
    navigate('/accounts', { replace: true, state: null });
    setIndustryFilter("all");
    setCountryFilter(null);
    setSourceFilter(null);
    setFitFilter(null);
    // Clear ICP-specific filters
    setIcpIndustries([]);
    setIcpGeographies([]);
    setIcpSizes([]);
    setIcpRevenues([]);
  };

  // Check ICP and scoring status
  useEffect(() => {
    if (!userProfile?.org_id || accounts.length === 0) return;

    const checkICPStatus = async () => {
      const { data: icpData } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', userProfile.org_id)
        .eq('status', 'active');

      const hasICP = (icpData?.length || 0) > 0;
      setHasActiveICP(hasICP);

      const hasScores = accounts.some(a => a.score !== null);
      setNeedsScoring(accounts.length > 0 && hasICP && !hasScores);

      if (hasScores) {
        completeStep('view_scores');
      }
    };

    checkICPStatus();
  }, [userProfile?.org_id, accounts, completeStep]);

  // Load summary stats
  useEffect(() => {
    if (userProfile?.org_id) {
      loadSummaryStats();
    }
  }, [userProfile?.org_id]);

  const loadSummaryStats = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      // Query 1: Unfiltered org-wide totals (always matches Dashboard)
      const [
        { count: unfilteredTotal },
        { count: unfilteredCrmCount },
        { count: unfilteredDbCount },
        { data: highFitCountData },
        { data: highFitLeadsCount },
        { data: allAccountsForQuality }
      ] = await Promise.all([
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id),
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .in('data_source', ['crm', 'both', 'closed_won']),
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .eq('data_source', 'database'),
        supabase
          .rpc('count_high_fit_accounts_by_source', {
            p_org_id: userProfile.org_id,
            p_data_source: 'crm'
          }),
        supabase
          .rpc('count_high_fit_leads_total', {
            p_org_id: userProfile.org_id
          }),
        supabase
          .from('accounts')
          .select('name, domain, industry_norm, employee_count, revenue_range, country')
          .eq('org_id', userProfile.org_id)
          .limit(50000)
      ]);

      // Calculate unfiltered org-wide totals
      const unfilteredHighFitCount = highFitCountData || 0;
      const unfilteredWithLeads = highFitLeadsCount || 0;
      
      const qualityScores = (allAccountsForQuality || []).map(acc => {
        const fields = [acc.name, acc.domain, acc.industry_norm, acc.employee_count, acc.revenue_range, acc.country];
        const filled = fields.filter(f => f !== null && f !== undefined).length;
        return Math.round((filled / fields.length) * 100);
      });
      
      const unfilteredAvgQuality = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
        : 0;

      // Store unfiltered totals
      setUnfilteredTotals({
        total: unfilteredTotal || 0,
        crm: unfilteredCrmCount || 0,
        database: unfilteredDbCount || 0,
        highFit: unfilteredHighFitCount,
        withLeads: unfilteredWithLeads,
        avgQuality: unfilteredAvgQuality
      });

      // Query 2: Filtered counts (for "Filtered Results" display)
      let filteredQuery = supabase
        .from('accounts')
        .select('data_source', { count: 'exact' })
        .eq('org_id', userProfile.org_id);

      if (sourceFilter && sourceFilter !== 'all') {
        if (sourceFilter === 'crm') {
          filteredQuery = filteredQuery.in('data_source', ['crm', 'both', 'closed_won']);
        } else if (sourceFilter === 'database') {
          filteredQuery = filteredQuery.eq('data_source', 'database');
        }
      }
      if (countryFilter) filteredQuery = filteredQuery.eq('country', countryFilter);
      if (stateFilter) filteredQuery = filteredQuery.eq('state_province', stateFilter);

      const { count: filteredCount, data: filteredAccountsData } = await filteredQuery;

      const filteredCrmCount = (filteredAccountsData || []).filter(a => a.data_source === 'crm' || a.data_source === 'both' || a.data_source === 'closed_won').length;
      const filteredDbCount = (filteredAccountsData || []).filter(a => a.data_source === 'database').length;

      setTotalAccountsForSummary(filteredCount || 0);
      setSummaryStats({
        withContacts: unfilteredWithLeads, // Keep unfiltered
        avgQuality: unfilteredAvgQuality, // Keep unfiltered
        highFit: unfilteredHighFitCount, // Keep unfiltered
        crmAccounts: filteredCrmCount,
        databaseAccounts: filteredDbCount
      });
    } catch (error) {
      console.error('Error loading summary stats:', error);
    }
  };

  const calculateDataCompleteness = (account: Account): number => {
    const fields = [
      account.name,
      account.domain,
      account.industry_norm,
      account.employee_count,
      account.revenue_range,
      account.country
    ];
    const filledFields = fields.filter(field => field !== null && field !== undefined).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const getDataQualityBadge = (completeness: number) => {
    if (completeness >= 80) return <Badge className="bg-success">High Quality</Badge>;
    if (completeness >= 50) return <Badge variant="secondary">Medium Quality</Badge>;
    return <Badge variant="outline">Low Quality</Badge>;
  };

  const exportToCSV = async (exportAll: boolean = false) => {
    // For current page
    const dataToExport = accounts;
    
    if (!exportAll && dataToExport.length === 0) {
      toast({
        title: "No data to export",
        description: "No accounts on current page",
        variant: "destructive"
      });
      return;
    }

    // If exporting all, fetch all accounts
    if (exportAll) {
      if (!userProfile?.org_id) return;
      
      try {
        let query = supabase
          .from('accounts')
          .select('*')
          .eq('org_id', userProfile.org_id);

        if (searchTerm) {
          query = query.or(`name.ilike.%${searchTerm}%,domain.ilike.%${searchTerm}%,industry_raw.ilike.%${searchTerm}%`);
        }
        if (industryFilter !== "all") {
          query = query.eq('industry_norm', industryFilter);
        }

        const { data: allAccountsData } = await query.order('name', { ascending: true });
        
        if (!allAccountsData || allAccountsData.length === 0) {
          toast({
            title: "No data to export",
            description: "No accounts match your filters",
            variant: "destructive"
          });
          return;
        }

        // Fetch scores for all accounts
        const accountIds = allAccountsData.map(a => a.external_id);
        const { data: scoresData } = await supabase
          .from('scores')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountIds);

        const { data: leadsData } = await supabase
          .from('Leads')
          .select('account_external_id')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountIds);

        const scoresMap = new Map((scoresData || []).map(s => [s.account_external_id, s]));
        const leadsMap = new Map<string, number>();
        (leadsData || []).forEach(l => {
          leadsMap.set(l.account_external_id, (leadsMap.get(l.account_external_id) || 0) + 1);
        });

        const fullAccounts = allAccountsData.map(account => ({
          ...account,
          data_source: (account.data_source || 'crm') as 'crm' | 'database' | 'both',
          score: scoresMap.get(account.external_id) ? {
            overall: scoresMap.get(account.external_id)!.overall,
            fit: scoresMap.get(account.external_id)!.fit,
            intent: scoresMap.get(account.external_id)!.intent,
            reachability: scoresMap.get(account.external_id)!.reachability
          } : null,
          contacts: leadsMap.get(account.external_id) || 0
        }));

        exportCSVData(fullAccounts, exportAll);
      } catch (error) {
        console.error('Error exporting all accounts:', error);
        toast({
          title: "Export failed",
          description: "Failed to fetch all accounts",
          variant: "destructive"
        });
      }
      return;
    }

    exportCSVData(dataToExport, exportAll);
  };

  const exportCSVData = async (dataToExport: Account[], exportAll: boolean) => {
    if (!userProfile?.org_id) return;

    try {
      // Fetch all leads for the accounts
      const accountIds = dataToExport.map(acc => acc.external_id);
      
      const { data: leads, error } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', accountIds)
        .order('account_external_id');

      if (error) throw error;

      if (!leads || leads.length === 0) {
        toast({
          title: "No leads found",
          description: "No leads are linked to these accounts",
          variant: "destructive"
        });
        return;
      }

      // Create a map of accounts for quick lookup
      const accountMap = new Map(
        dataToExport.map(acc => [acc.external_id, acc])
      );

      const headers = [
        'First Name',
        'Last Name',
        'Email',
        'Title',
        'Persona',
        'Phone',
        'Mobile',
        'Lead Status',
        'Account Name',
        'Domain',
        'Industry',
        'Employee Count',
        'Country',
        'State/Province',
        'ICP Score',
        'Data Source'
      ];

      const rows = leads.map(lead => {
        const account = accountMap.get(lead.account_external_id);
        return [
          lead.first_name || '',
          lead.last_name || '',
          lead.email || '',
          lead.title || '',
          lead.persona || '',
          lead.phone || '',
          lead.mobile || '',
          lead.status || '',
          account?.name || '',
          account?.domain || '',
          account?.industry_norm || lead.industry || '',
          account?.employee_count || lead.employee_count || '',
          account?.country || lead.country || '',
          lead.state_province || '',
          account?.score?.overall || '',
          getSourceLabel(account?.data_source || 'crm')
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
      const filename = exportAll 
        ? `all_leads_export_${new Date().toISOString().split('T')[0]}.csv`
        : `filtered_leads_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "✓ Leads Exported",
        description: `${formatNumber(leads.length)} leads from ${formatNumber(dataToExport.length)} accounts exported to CSV`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export leads. Please try again.",
        variant: "destructive"
      });
    }
  };

  const [uniqueCountries, setUniqueCountries] = useState<string[]>([]);
  const [uniqueStates, setUniqueStates] = useState<string[]>([]);

  // Get sub-industries for selected primary industry
  const availableSubIndustries = useMemo(() => {
    if (industryFilter === "all") return [];
    return SUB_INDUSTRIES_MAP[industryFilter] || [];
  }, [industryFilter]);

  // Reset sub-industry filter when primary industry changes
  useEffect(() => {
    if (industryFilter === "all") {
      setSubIndustryFilter("all");
    } else if (subIndustryFilter !== "all" && !availableSubIndustries.includes(subIndustryFilter)) {
      setSubIndustryFilter("all");
    }
  }, [industryFilter, availableSubIndustries, subIndustryFilter]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!userProfile?.org_id) return;
      
      const { data } = await supabase
        .from('accounts')
        .select('country, state_province')
        .eq('org_id', userProfile.org_id);
      
      const countries = Array.from(new Set((data || []).map(a => a.country).filter(Boolean))).sort();
      const states = Array.from(new Set((data || []).map(a => a.state_province).filter(Boolean))).sort();
      
      setUniqueCountries(countries);
      setUniqueStates(states);
    };
    
    fetchFilterOptions();
  }, [userProfile?.org_id]);

  const clearFilters = () => {
    setSearchParams({});
    setSourceFilter(null);
    setFitFilter(null);
    setCountryFilter(null);
    setStateFilter(null);
    setIcpFilter(null);
    setSearchTerm("");
    setIndustryFilter("all");
    setSubIndustryFilter("all");
  };

  const removeFilter = (filterType: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(filterType);
    setSearchParams(params);
  };

  const hasActiveFilters = sourceFilter || fitFilter || countryFilter || stateFilter || icpFilter || searchTerm || industryFilter !== "all" || subIndustryFilter !== "all";

  if (isLoading && accounts.length === 0) {
    return <TableSkeleton rows={10} columns={7} showMetrics showFilters />;
  }

  return (
    <div className="space-y-6">
      {/* Enhanced ICP Context Card */}
      {icpContext && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-secondary/5">
          <Collapsible open={icpDetailsOpen} onOpenChange={setIcpDetailsOpen}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">ICP Context: {icpContext.icpName}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Account filters are automatically applied from this ICP
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('/icp-manager', { state: { editIcpId: icpContext.icpId } })}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit ICP
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearICPContext}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className={`h-4 w-4 transition-transform ${icpDetailsOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </CardHeader>
            
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Industries */}
                {icpIndustries.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Target Industries ({icpIndustries.length})</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {icpIndustries.map(industry => (
                        <Badge key={industry} variant="secondary">
                          {industry}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Geographies */}
                {icpGeographies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Target Countries ({icpGeographies.length})</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {icpGeographies.map(country => (
                        <Badge key={country} variant="secondary">
                          {country}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Company Sizes */}
                {icpSizes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Company Sizes ({icpSizes.length} ranges)</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {icpSizes.map((size, index) => {
                        const nextSize = icpSizes[index + 1];
                        const label = nextSize 
                          ? `${formatNumber(size)}-${formatNumber(nextSize - 1)} employees` 
                          : `${formatNumber(size)}+ employees`;
                        return (
                          <Badge key={size} variant="secondary">
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Revenue Ranges */}
                {icpRevenues.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Revenue Ranges ({icpRevenues.length})</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {icpRevenues.map(rev => (
                        <Badge key={rev} variant="secondary">
                          {rev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Alert className="bg-muted/50 border-0">
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    All accounts shown below match these ICP criteria. Use additional filters to further refine results.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Breadcrumb Navigation */}
      {icpContext && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/icp-manager" className="hover:text-primary transition-colors">ICP Manager</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{icpContext.icpName}</span>
          <span>/</span>
          <span className="text-foreground">Accounts</span>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Accounts</h1>
          <p className="text-muted-foreground mt-2">
            {icpContext ? 'Build targeted account lists for campaigns using ICP criteria' : 'Complete CRM database view'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={() => setShowEnrichmentModal(true)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Enrich Account Data
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCSV(false)}>
                Export Current Page ({accounts.length} accounts)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToCSV(true)}>
                Export All Filtered ({totalCount} accounts)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Compact Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Accounts Overview</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold">{formatNumber(unfilteredTotals.total)}</div>
            <div className="text-sm text-muted-foreground">Total Accounts</div>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {formatNumber(unfilteredTotals.crm)} CRM
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {formatNumber(unfilteredTotals.database)} Database
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
            <div>
              <div className="text-sm font-medium">{formatNumber(unfilteredTotals.highFit)}</div>
              <div className="text-xs text-muted-foreground">
                High-Fit ({unfilteredTotals.total > 0 ? Math.round((unfilteredTotals.highFit / unfilteredTotals.total) * 100) : 0}%)
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">{unfilteredTotals.avgQuality}%</div>
              <div className="text-xs text-muted-foreground">Avg Quality</div>
            </div>
            <div>
              <div className="text-sm font-medium">{formatNumber(unfilteredTotals.withLeads)}</div>
              <div className="text-xs text-muted-foreground">High-Fit Leads</div>
            </div>
          </div>

          {/* Filtered Results (only show when filters are active) */}
          {hasActiveFilters && totalAccountsForSummary !== unfilteredTotals.total && (
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Filtered Results: {formatNumber(totalAccountsForSummary)} accounts
                </span>
                <span className="text-xs text-muted-foreground">
                  ({summaryStats.crmAccounts} CRM, {summaryStats.databaseAccounts} Database)
                </span>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="pt-3 border-t bg-muted/30 -mx-6 px-6 py-3 mt-3">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Active Filters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sourceFilter && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    Source: {sourceFilter === 'crm' ? 'CRM' : 'Database'}
                    <X className="h-3 w-3" onClick={() => removeFilter('source')} />
                  </Badge>
                )}
                {fitFilter && (
                  <Badge 
                    className={`gap-1 cursor-pointer border ${
                      fitFilter === 'high' 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                        : fitFilter === 'medium' 
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20' 
                        : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20'
                    }`}
                  >
                    {fitFilter === 'high' && <CheckCircle2 className="h-3 w-3" />}
                    {fitFilter === 'medium' && <TrendingUp className="h-3 w-3" />}
                    {fitFilter === 'low' && <AlertCircle className="h-3 w-3" />}
                    {fitFilter.charAt(0).toUpperCase() + fitFilter.slice(1)} Fit
                    <X className="h-3 w-3" onClick={() => removeFilter('fit')} />
                  </Badge>
                )}
                {countryFilter && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    Country: {countryFilter}
                    <X className="h-3 w-3" onClick={() => removeFilter('country')} />
                  </Badge>
                )}
                {stateFilter && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    State: {stateFilter}
                    <X className="h-3 w-3" onClick={() => removeFilter('state')} />
                  </Badge>
                )}
                {icpFilter && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    ICP Filter Active
                    <X className="h-3 w-3" onClick={() => removeFilter('icp_id')} />
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    Search: "{searchTerm}"
                    <X className="h-3 w-3" onClick={() => setSearchTerm("")} />
                  </Badge>
                )}
                {industryFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    Primary Industry: {industryFilter}
                    <X className="h-3 w-3" onClick={() => setIndustryFilter("all")} />
                  </Badge>
                )}
                {subIndustryFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                    Sub-Industry: {subIndustryFilter}
                    <X className="h-3 w-3" onClick={() => setSubIndustryFilter("all")} />
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Alert */}
      {needsScoring && (
        <Alert className="border-primary bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Ready to score your accounts!</strong> You have {totalAccountsForSummary} accounts and an active ICP profile. 
            Use the Bulk Scoring Engine below to calculate ICP match scores for all accounts.
          </AlertDescription>
        </Alert>
      )}

      {/* Correlation Analysis */}
      <CorrelationInsights />

      {/* Bulk Scoring */}
      <BulkScoring onComplete={refresh} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select 
                value={sourceFilter || "all"} 
                onValueChange={(value) => {
                  const params = new URLSearchParams(searchParams);
                  if (value === "all") {
                    params.delete('source');
                  } else {
                    params.set('source', value);
                  }
                  setSearchParams(params);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={fitFilter || "all"} 
                onValueChange={(value) => {
                  const params = new URLSearchParams(searchParams);
                  if (value === "all") {
                    params.delete('fit');
                  } else {
                    params.set('fit', value);
                  }
                  setSearchParams(params);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Fit Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fit Levels</SelectItem>
                  <SelectItem value="high">High Fit</SelectItem>
                  <SelectItem value="medium">Medium Fit</SelectItem>
                  <SelectItem value="low">Low Fit</SelectItem>
                </SelectContent>
              </Select>

              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Primary Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Primary Industries</SelectItem>
                  {PRIMARY_INDUSTRIES.map(industry => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={subIndustryFilter} 
                onValueChange={setSubIndustryFilter}
                disabled={industryFilter === "all" || availableSubIndustries.length === 0}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={industryFilter === "all" ? "Select Primary First" : "Sub-Industry"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Industries</SelectItem>
                  {availableSubIndustries.map(subIndustry => (
                    <SelectItem key={subIndustry} value={subIndustry}>{subIndustry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={countryFilter || "all"} 
                onValueChange={(value) => {
                  const params = new URLSearchParams(searchParams);
                  if (value === "all") {
                    params.delete('country');
                  } else {
                    params.set('country', value);
                  }
                  setSearchParams(params);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {uniqueCountries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={stateFilter || "all"} 
                onValueChange={(value) => {
                  const params = new URLSearchParams(searchParams);
                  if (value === "all") {
                    params.delete('state');
                  } else {
                    params.set('state', value);
                  }
                  setSearchParams(params);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {uniqueStates.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts ({formatNumber(totalCount)})</CardTitle>
          <CardDescription>
            Click on any row to view detailed account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Enriched</TableHead>
                <TableHead>Data Quality</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Campaign Ready</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {fitFilter 
                            ? `No ${fitFilter.charAt(0).toUpperCase() + fitFilter.slice(1)}-Fit accounts found`
                            : hasActiveFilters 
                            ? "No accounts match your filters"
                            : "No accounts found"
                          }
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {fitFilter ? (
                            <>Try scoring more accounts or adjust your ICP criteria</>
                          ) : hasActiveFilters ? (
                            <>Try adjusting your filters to see more results</>
                          ) : (
                            <>Upload your CRM data to get started</>
                          )}
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          <X className="h-4 w-4 mr-2" />
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
                  const completeness = calculateDataCompleteness(account);
                  return (
                    <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedAccountForDetail(account);
                      setShowDetailDrawer(true);
                    }}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{account.name || 'Unknown Company'}</div>
                        <div className="text-sm text-muted-foreground">{account.domain}</div>
                      </div>
                    </TableCell>
                    <TableCell>{account.industry_norm || account.industry_raw || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <div>{account.employee_count ? `${account.employee_count} employees` : '-'}</div>
                        <div className="text-sm text-muted-foreground">{account.revenue_range || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell>{account.country || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getSourceBadgeVariant(account.data_source || 'crm')}>
                        {getSourceLabel(account.data_source || 'crm')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.enriched_from ? (
                        <div className="flex items-center gap-1">
                          {account.enriched_from.split(',').map((source: string, idx: number) => (
                            <Badge 
                              key={idx}
                              variant={
                                source.trim() === 'clearbit' ? 'default' :
                                source.trim() === 'ai' ? 'secondary' :
                                source.trim() === 'pdl' ? 'outline' : 'outline'
                              }
                              className="text-xs"
                              title={account.enriched_at ? `Enriched ${new Date(account.enriched_at).toLocaleDateString()}` : ''}
                            >
                              {source.trim() === 'clearbit' ? 'CB' :
                               source.trim() === 'ai' ? 'AI' :
                               source.trim() === 'pdl' ? 'PDL' : source.trim().toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={completeness} className="w-16 h-2" />
                        <span className="text-sm">{completeness.toFixed(2)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {account.contacts || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {account.campaignReadyContacts !== undefined && account.campaignReadyContacts > 0 ? (
                          <>
                            <Badge variant="default" className="w-fit">
                              {account.campaignReadyContacts}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              of {account.contacts || 0}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.score?.overall ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className={`flex items-center justify-center w-14 h-14 rounded-lg font-bold text-lg cursor-pointer transition-all hover:scale-105 ${
                              account.score.overall >= 80 ? 'bg-[hsl(var(--signal-high))]/20 text-[hsl(var(--signal-high))]' :
                              account.score.overall >= 60 ? 'bg-[hsl(var(--signal-medium))]/20 text-[hsl(var(--signal-medium))]' :
                              'bg-[hsl(var(--signal-low))]/20 text-[hsl(var(--signal-low))]'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAccountForScore(account);
                              setShowScoreDialog(true);
                            }}
                            title="Click for score breakdown"
                          >
                            {account.score.overall}
                          </div>
                          <div className="text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Fit:</span>
                              <span className="font-medium">{account.score.fit}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Intent:</span>
                              <span className="font-medium">{account.score.intent}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-5 text-xs mt-1 px-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAccountForScore(account);
                                setShowScoreDialog(true);
                              }}
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No score</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.external_database_match && account.data_source === 'database' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnrichingSingleAccount(account.external_id);
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Enrich
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
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
            itemsCount={accounts.length}
            totalCount={totalCount}
          />
        </CardContent>
      </Card>

      <ScoreBreakdownDialog
        isOpen={showScoreDialog}
        onClose={() => setShowScoreDialog(false)}
        account={selectedAccountForScore ? {
          name: selectedAccountForScore.name || 'Unknown',
          overall: selectedAccountForScore.score?.overall || 0,
          fit: selectedAccountForScore.score?.fit || 0,
          intent: selectedAccountForScore.score?.intent || 0,
          reachability: selectedAccountForScore.score?.reachability || 0,
          reasons: {
            fit_positives: selectedAccountForScore.industry_norm ? [`Industry: ${selectedAccountForScore.industry_norm}`] : [],
            fit_negatives: !selectedAccountForScore.employee_count ? ['Missing employee count data'] : [],
            intent_signals: [],
            reachability_factors: selectedAccountForScore.contacts && selectedAccountForScore.contacts > 0 ? [`${selectedAccountForScore.contacts} contacts available`] : ['No contacts available']
          }
        } : null}
      />

      <AccountDetailDrawer
        account={selectedAccountForDetail}
        isOpen={showDetailDrawer}
        onClose={() => setShowDetailDrawer(false)}
        onViewScore={(account) => {
          setSelectedAccountForScore(account);
          setShowScoreDialog(true);
        }}
      />

      <EnrichmentModal
        open={!!enrichingSingleAccount}
        onOpenChange={(open) => !open && setEnrichingSingleAccount(null)}
        selectedAccounts={1}
      />

      <EnrichmentModal
        open={showEnrichmentModal}
        onOpenChange={setShowEnrichmentModal}
        selectedAccounts={totalCount}
      />
    </div>
  );
}
