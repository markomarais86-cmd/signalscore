import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useToast } from "@/hooks/use-toast";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ScoreBreakdownDialog } from "@/components/scoring/ScoreBreakdownDialog";
import { AccountDetailDrawer } from "@/components/accounts/AccountDetailDrawer";
import { BulkScoring } from "@/components/BulkScoring";
import { ComponentErrorBoundary } from "@/components/ComponentErrorBoundary";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { CampaignBuilderV2 } from "@/components/campaigns/CampaignBuilderV2";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useInfiniteAccounts } from "@/hooks/use-infinite-accounts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useBatchPredictions } from "@/hooks/use-predictions";
import { accountsLogger } from "@/lib/logger";
import { SUB_INDUSTRIES_MAP } from "@/constants/zoominfo-industries";

// Modular components
import { AccountsHeader } from "@/components/accounts/AccountsHeader";
import { AccountsFilters } from "@/components/accounts/AccountsFilters";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import { AccountsSummaryCard } from "@/components/accounts/AccountsSummaryCard";
import { AccountsICPContext } from "@/components/accounts/AccountsICPContext";
import { PriorityRevenueAccounts } from "@/components/executive/PriorityRevenueAccounts";

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
    reasons?: Array<{
      factor: string;
      match: boolean;
      score: number;
      value: string | number;
      icp_range?: { min: number; max: number };
    }>;
  } | null;
  leads?: number;
  campaignReadyLeads?: number;
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

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [subIndustryFilter, setSubIndustryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [fitFilter, setFitFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [icpFilter, setIcpFilter] = useState<string | null>(null);
  const [campaignReadyFilter, setCampaignReadyFilter] = useState<boolean>(false);
  
  // Sorting states
  const [sortField, setSortField] = useState<'name' | 'industry_norm' | 'country' | 'score' | 'leads' | 'data_quality' | 'updated_at'>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // ICP-specific filter states
  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [icpGeographies, setIcpGeographies] = useState<string[]>([]);
  const [icpSizes, setIcpSizes] = useState<number[]>([]);
  const [icpRevenues, setIcpRevenues] = useState<string[]>([]);
  
  // UI states
  const [selectedAccountForScore, setSelectedAccountForScore] = useState<Account | null>(null);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [activeIcpId, setActiveIcpId] = useState<string | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [enrichingSingleAccount, setEnrichingSingleAccount] = useState<string | null>(null);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [hasActiveICP, setHasActiveICP] = useState(false);
  const [needsScoring, setNeedsScoring] = useState(false);
  const [icpDetailsOpen, setIcpDetailsOpen] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<'realtime' | 'cached'>('cached');
  const [integrationConfigId, setIntegrationConfigId] = useState<string | null>(null);
  
  // Summary stats
  const [totalAccountsForSummary, setTotalAccountsForSummary] = useState(0);
  const [unfilteredTotals, setUnfilteredTotals] = useState({
    total: 0,
    crm: 0,
    database: 0,
    highFit: 0,
    withLeads: 0,
    avgQuality: 0
  });
  
  // Filter options
  const [uniqueCountries, setUniqueCountries] = useState<string[]>([]);
  const [uniqueStates, setUniqueStates] = useState<string[]>([]);
  
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();

  // Fetch integration config on mount
  useEffect(() => {
    const fetchIntegrationConfig = async () => {
      if (!effectiveOrgId) return;
      
      const { data } = await supabase
        .from('integration_configs')
        .select('id, integration_type, status')
        .eq('org_id', effectiveOrgId)
        .eq('status', 'connected')
        .in('integration_type', ['salesforce', 'hubspot'])
        .maybeSingle();
      
      if (data) {
        setIntegrationConfigId(data.id);
      }
    };
    
    fetchIntegrationConfig();
  }, [effectiveOrgId]);

  // Fetch active ICP as fallback when icpContext is missing
  useEffect(() => {
    const fetchActiveIcp = async () => {
      if (!effectiveOrgId || icpContext?.icpId) return;
      
      const { data } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', effectiveOrgId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setActiveIcpId(data.id);
      }
    };
    
    fetchActiveIcp();
  }, [effectiveOrgId, icpContext?.icpId]);

  // Fetch predictions for accounts
  const { data: predictionsData, isPending: isPredictionsLoading } = useBatchPredictions(effectiveOrgId || null);
  
  // Create predictions map for fast lookup
  const predictionsMap = useMemo(() => {
    const map = new Map<string, { account_id: string; probability: number; confidence: number }>();
    if (predictionsData?.predictions) {
      for (const pred of predictionsData.predictions) {
        map.set(pred.account_id, pred);
      }
    }
    return map;
  }, [predictionsData]);

  // Handle sorting
  const handleSort = (field: 'name' | 'industry_norm' | 'country' | 'score' | 'leads' | 'data_quality' | 'updated_at') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
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
    orgId: effectiveOrgId || null,
    pageSize: 25,
    searchTerm,
    industryFilter,
    subIndustryFilter,
    sourceFilter,
    fitFilter,
    countryFilter,
    campaignReadyFilter,
    enabled: !!effectiveOrgId,
    mode: displayMode,
    integrationConfigId: integrationConfigId || undefined,
    sortField,
    sortDirection,
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

  // Pre-populate filters from ICP context
  useEffect(() => {
    if (icpContext?.prefilters) {
      if (icpContext.prefilters.industries?.length) {
        setIcpIndustries(icpContext.prefilters.industries);
      }
      if (icpContext.prefilters.geographies?.length) {
        setIcpGeographies(icpContext.prefilters.geographies);
      }
      if (icpContext.prefilters.companySizes?.length) {
        setIcpSizes(icpContext.prefilters.companySizes);
      }
      if (icpContext.prefilters.revenueRanges?.length) {
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
    setIcpIndustries([]);
    setIcpGeographies([]);
    setIcpSizes([]);
    setIcpRevenues([]);
  };

  // Check ICP and scoring status
  useEffect(() => {
    if (!effectiveOrgId || accounts.length === 0) return;

    const checkICPStatus = async () => {
      const { data: icpData } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', effectiveOrgId)
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
  }, [effectiveOrgId, accounts, completeStep]);

  // Load summary stats
  useEffect(() => {
    if (effectiveOrgId) {
      loadSummaryStats();
    }
  }, [effectiveOrgId]);

  const loadSummaryStats = async () => {
    if (!effectiveOrgId) return;
    
    try {
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
          .eq('org_id', effectiveOrgId),
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', effectiveOrgId)
          .in('data_source', ['crm', 'both', 'closed_won']),
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', effectiveOrgId)
          .eq('data_source', 'database'),
        supabase
          .rpc('count_high_fit_accounts_by_source', {
            p_org_id: effectiveOrgId,
            p_data_source: 'crm'
          }),
        supabase
          .rpc('count_high_fit_leads_total', {
            p_org_id: effectiveOrgId
          }),
        supabase
          .from('accounts')
          .select('name, domain, industry_norm, employee_count, revenue_range, country')
          .eq('org_id', effectiveOrgId)
          .limit(50000)
      ]);

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

      setUnfilteredTotals({
        total: unfilteredTotal || 0,
        crm: unfilteredCrmCount || 0,
        database: unfilteredDbCount || 0,
        highFit: unfilteredHighFitCount,
        withLeads: unfilteredWithLeads,
        avgQuality: unfilteredAvgQuality
      });

      setTotalAccountsForSummary(unfilteredTotal || 0);
    } catch (error) {
      accountsLogger.error('Error loading summary stats:', error);
    }
  };

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

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!effectiveOrgId) return;
      
      const { data } = await supabase
        .from('accounts')
        .select('country, state_province')
        .eq('org_id', effectiveOrgId);
      
      const countries = Array.from(new Set((data || []).map(a => a.country).filter(Boolean))).sort();
      const states = Array.from(new Set((data || []).map(a => a.state_province).filter(Boolean))).sort();
      
      setUniqueCountries(countries);
      setUniqueStates(states);
    };
    
    fetchFilterOptions();
  }, [effectiveOrgId]);

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
    setCampaignReadyFilter(false);
  };

  const removeFilter = (filterType: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(filterType);
    setSearchParams(params);
  };

  const hasActiveFilters = !!(sourceFilter || fitFilter || countryFilter || stateFilter || icpFilter || searchTerm || industryFilter !== "all" || subIndustryFilter !== "all" || campaignReadyFilter);

  // Show loading skeleton while auth or accounts are loading
  if (!userProfile || (isLoading && accounts.length === 0)) {
    return <TableSkeleton rows={10} columns={7} showMetrics showFilters />;
  }

  return (
    <div className="space-y-6">
      {/* ICP Context Card */}
      {icpContext && (
        <AccountsICPContext
          icpContext={icpContext}
          icpDetailsOpen={icpDetailsOpen}
          setIcpDetailsOpen={setIcpDetailsOpen}
          icpIndustries={icpIndustries}
          icpGeographies={icpGeographies}
          icpSizes={icpSizes}
          icpRevenues={icpRevenues}
          onClearContext={clearICPContext}
        />
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

      {/* Header with actions */}
      <AccountsHeader
        icpContext={icpContext}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
        integrationConfigId={integrationConfigId}
        selectedAccountIds={selectedAccountIds}
        hasActiveFilters={hasActiveFilters}
        isLoading={isLoading}
        totalCount={totalCount}
        onOpenCampaignBuilder={() => setShowCampaignBuilder(true)}
        onOpenEnrichmentModal={() => setShowEnrichmentModal(true)}
        onRefresh={refresh}
      />

      {/* Summary Card */}
      <AccountsSummaryCard
        unfilteredTotals={unfilteredTotals}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        sourceFilter={sourceFilter}
        fitFilter={fitFilter}
        countryFilter={countryFilter}
        stateFilter={stateFilter}
        icpFilter={icpFilter}
        searchTerm={searchTerm}
        industryFilter={industryFilter}
        subIndustryFilter={subIndustryFilter}
        campaignReadyFilter={campaignReadyFilter}
        setSearchTerm={setSearchTerm}
        setIndustryFilter={setIndustryFilter}
        setSubIndustryFilter={setSubIndustryFilter}
        setCampaignReadyFilter={setCampaignReadyFilter}
        removeFilter={removeFilter}
      />

      {/* Priority Revenue Accounts */}
      <PriorityRevenueAccounts />

      {/* Scoring Alert */}
      {needsScoring && (
        <Alert className="border-primary bg-primary/5">
          <LaunchPulseMark className="w-4 h-4" />
          <AlertDescription>
            <strong>Ready to score your accounts!</strong> You have {totalAccountsForSummary} accounts and an active ICP profile. 
            Use the Bulk Scoring Engine below to calculate ICP match scores for all accounts.
          </AlertDescription>
        </Alert>
      )}

      {/* Bulk Scoring */}
      <ComponentErrorBoundary fallbackTitle="Bulk Scoring unavailable">
        <BulkScoring onComplete={refresh} />
      </ComponentErrorBoundary>

      {/* Filters */}
      <AccountsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        fitFilter={fitFilter}
        setFitFilter={setFitFilter}
        industryFilter={industryFilter}
        setIndustryFilter={setIndustryFilter}
        subIndustryFilter={subIndustryFilter}
        setSubIndustryFilter={setSubIndustryFilter}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        campaignReadyFilter={campaignReadyFilter}
        setCampaignReadyFilter={setCampaignReadyFilter}
        uniqueCountries={uniqueCountries}
        uniqueStates={uniqueStates}
        availableSubIndustries={availableSubIndustries}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
      />

      {/* Accounts Table */}
      <AccountsTable
        accounts={accounts}
        totalCount={totalCount}
        selectedAccountIds={selectedAccountIds}
        setSelectedAccountIds={setSelectedAccountIds}
        onAccountClick={(account) => {
          setSelectedAccountForDetail(account);
          setShowDetailDrawer(true);
        }}
        onScoreClick={(account) => {
          setSelectedAccountForScore(account);
          setShowScoreDialog(true);
        }}
        hasActiveFilters={hasActiveFilters}
        fitFilter={fitFilter}
        clearFilters={clearFilters}
        predictions={predictionsMap}
        isPredictionsLoading={isPredictionsLoading}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        observerTarget={observerTarget}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        loadMore={loadMore}
        retry={retry}
        lastError={lastError}
      />

      {/* Dialogs and Modals */}
      <ScoreBreakdownDialog
        isOpen={showScoreDialog}
        onClose={() => setShowScoreDialog(false)}
        account={selectedAccountForScore ? {
          name: selectedAccountForScore.name || 'Unknown',
          overall: selectedAccountForScore.score?.overall || 0,
          fit: selectedAccountForScore.score?.fit || 0,
          intent: selectedAccountForScore.score?.intent || 0,
          reachability: selectedAccountForScore.score?.reachability || 0,
          reasons: (() => {
            const dbReasons = selectedAccountForScore.score?.reasons || [];
            const fit_positives: string[] = [];
            const fit_negatives: string[] = [];
            
            dbReasons.forEach((r: any) => {
              const factorLabel = r.factor.charAt(0).toUpperCase() + r.factor.slice(1);
              if (r.match) {
                if (r.factor === 'size' && r.icp_range) {
                  fit_positives.push(`${factorLabel}: ${r.value?.toLocaleString()} employees (ICP range: ${r.icp_range.min?.toLocaleString()}-${r.icp_range.max?.toLocaleString()})`);
                } else {
                  fit_positives.push(`${factorLabel}: ${r.value} (${r.score}% match)`);
                }
              } else {
                fit_negatives.push(`${factorLabel}: ${r.value || 'No data'} (no match)`);
              }
            });
            
            if (dbReasons.length === 0) {
              if (selectedAccountForScore.industry_norm) {
                fit_positives.push(`Industry: ${selectedAccountForScore.industry_norm}`);
              } else {
                fit_negatives.push('Missing industry data');
              }
              if (!selectedAccountForScore.employee_count) {
                fit_negatives.push('Missing employee count data');
              }
              if (!selectedAccountForScore.revenue_range) {
                fit_negatives.push('Missing revenue data');
              }
              if (!selectedAccountForScore.country) {
                fit_negatives.push('Missing geography data');
              }
            }
            
            return {
              fit_positives,
              fit_negatives,
              intent_signals: [],
              reachability_factors: selectedAccountForScore.leads && selectedAccountForScore.leads > 0 
                ? [`${selectedAccountForScore.leads} leads available`] 
                : ['No leads available']
            };
          })()
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
      />

      <CampaignBuilderV2
        isOpen={showCampaignBuilder}
        onClose={() => setShowCampaignBuilder(false)}
        icpId={activeIcpId || icpContext?.icpId}
        source="icp-manager"
      />
    </div>
  );
}
