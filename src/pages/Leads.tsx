import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Sparkles, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/utils/format-numbers";
import { useAuth } from "@/hooks/use-auth";
import { useDataOrgId } from "@/hooks/use-data-org";
import { useToast } from "@/hooks/use-toast";
import { leadsLogger } from "@/lib/logger";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { useInfiniteLeads } from "@/hooks/use-infinite-leads";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useLeadsMetrics } from "@/hooks/use-leads-metrics";
import { TableSkeleton } from "@/components/TableSkeleton";
import { AllLeadsView } from "@/components/leads/AllLeadsView";
import { EnrichedLeadsView } from "@/components/leads/EnrichedLeadsView";

export default function Leads() {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('campaign_ready') === 'true') setCampaignReadyFilter('ready');
    if (params.get('source')) setLinkFilter(params.get('source') === 'crm' ? 'linked' : params.get('source')!);
    if (params.get('status')) setStatusFilter(params.get('status')!);
    if (params.get('icp') === 'qualified') setIcpFilter('qualified');
    if (params.get('stale_days')) setStaleDaysFilter(parseInt(params.get('stale_days')!, 10));
    if (params.get('view') === 'enriched') setActiveView('enriched');
  }, []);

  const {
    leads, isLoading, isLoadingMore, hasMore, totalCount, loadMore, refresh, retry, lastError
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

  const { data: metrics, isLoading: metricsLoading } = useLeadsMetrics(effectiveOrgId);

  const { observerTarget } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore
  });

  const handleAutoMatch = async () => {
    if (!effectiveOrgId) {
      toast({ title: "Error", description: "No organization ID found", variant: "destructive" });
      return;
    }
    setIsMatching(true);
    try {
      leadsLogger.info('Starting fast SQL-based lead-to-account matching...');
      toast({ title: "Matching Leads...", description: "This will take just a few seconds." });
      const { data, error } = await supabase.rpc('match_leads_to_accounts_fast', { p_org_id: effectiveOrgId });
      if (error) throw error;
      const result = data as { success: boolean; total_linked: number; matched_to_existing: number; new_accounts_created: number; failed: number };
      if (result.success) {
        toast({ title: "✓ Leads Matched Successfully", description: `${formatNumber(result.total_linked)} leads linked` });
        await refresh();
      } else {
        throw new Error('Matching failed');
      }
    } catch (error) {
      leadsLogger.error('Error matching leads:', error);
      toast({ title: "Matching Failed", description: error instanceof Error ? error.message : "Could not link leads to accounts.", variant: "destructive" });
    } finally {
      setIsMatching(false);
    }
  };

  const handleRescore = async (lead: any) => {
    if (!lead.account_external_id) {
      toast({ title: "Cannot rescore", description: "Lead must be linked to an account first", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('score-accounts', { body: { org_id: effectiveOrgId, account_ids: [lead.account_external_id] } });
      if (error) throw error;
      toast({ title: "Success", description: "Account rescored successfully" });
      refresh();
    } catch (error) {
      toast({ title: "Scoring failed", description: error instanceof Error ? error.message : "Could not rescore account", variant: "destructive" });
    }
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

  return (
    <div className="space-y-6">
      <DemoModeBanner />
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-semibold leading-tight">Leads</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-5 w-5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs"><p><strong>Leads</strong> are individual contacts at your accounts.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs lg:text-sm text-muted-foreground mt-1">All people linked to accounts in your pipeline</p>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'all' | 'enriched')} className="w-full">
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />All Leads
            <Badge variant="secondary" className="ml-1">{formatNumber(totalCount)}</Badge>
          </TabsTrigger>
          <TabsTrigger value="enriched" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />Enriched
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeView === 'all' && (
        <AllLeadsView
          leads={leads} isLoading={isLoading} isLoadingMore={isLoadingMore}
          hasMore={hasMore} totalCount={totalCount} loadMore={loadMore}
          refresh={refresh} retry={retry} lastError={lastError}
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          linkFilter={linkFilter} setLinkFilter={setLinkFilter}
          personaFilter={personaFilter} setPersonaFilter={setPersonaFilter}
          campaignReadyFilter={campaignReadyFilter} setCampaignReadyFilter={setCampaignReadyFilter}
          icpFilter={icpFilter} setIcpFilter={setIcpFilter}
          isMatching={isMatching} handleAutoMatch={handleAutoMatch}
          handleRescore={handleRescore} hasAttemptedMatch={hasAttemptedMatch}
          showMatcher={showMatcher} setShowMatcher={setShowMatcher}
          metrics={metrics} metricsLoading={metricsLoading}
          demoMode={flags.demo_mode} observerTarget={observerTarget}
          effectiveOrgId={effectiveOrgId}
        />
      )}

      {activeView === 'enriched' && (
        <EnrichedLeadsView effectiveOrgId={effectiveOrgId} />
      )}
    </div>
  );
}
