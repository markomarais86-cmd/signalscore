import { useState } from "react";
import { Sparkles, TrendingUp, Phone, Mail } from "lucide-react";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { useAuth } from "@/hooks/use-auth";
import { useEnrichedLeads, useEnrichedLeadsMetrics, EnrichedLead } from "@/hooks/use-enriched-leads";
import { EnrichedLeadsFilters } from "@/components/leads/EnrichedLeadsFilters";
import { EnrichedLeadsTable } from "@/components/leads/EnrichedLeadsTable";
import { EnrichedLeadsHeader } from "@/components/leads/EnrichedLeadsHeader";
import { formatNumber } from "@/utils/format-numbers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MultiPhoneDisplay } from "@/components/leads/MultiPhoneDisplay";
import { Badge } from "@/components/ui/badge";

export default function EnrichedLeads() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const orgId = userProfile?.org_id || null;

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [enrichmentSource, setEnrichmentSource] = useState("all");
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low' | 'all'>('all');
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [hasPhone, setHasPhone] = useState<boolean | null>(null);
  const [icpQualified, setIcpQualified] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<'name' | 'enriched_at' | 'enrichment_confidence'>('enriched_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailLead, setDetailLead] = useState<EnrichedLead | null>(null);

  // Data hooks
  const { leads, isLoading, isLoadingMore, hasMore, totalCount, loadMore, refresh } = useEnrichedLeads({
    orgId,
    searchTerm,
    enrichmentSource,
    confidenceLevel,
    dateRange,
    hasPhone,
    icpQualified,
    sortField,
    sortDirection
  });

  const metrics = useEnrichedLeadsMetrics(orgId);

  const handleSort = (field: 'name' | 'enriched_at' | 'enrichment_confidence') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setEnrichmentSource("all");
    setConfidenceLevel("all");
    setDateRange("all");
    setHasPhone(null);
    setIcpQualified(null);
  };

  const handleReEnrich = async (lead: EnrichedLead) => {
    if (!lead.email || !orgId) return;
    
    try {
      await supabase.functions.invoke('enrich-lead', {
        body: { 
          org_id: orgId, 
          leads: [{ email: lead.email, first_name: lead.first_name, last_name: lead.last_name, company: lead.company }],
          save_to_db: true
        }
      });
      toast({ title: "Re-enrichment started", description: `Processing ${lead.email}...` });
      setTimeout(refresh, 2000);
    } catch (error) {
      toast({ title: "Failed", description: "Could not start re-enrichment", variant: "destructive" });
    }
  };

  const selectedLeads = leads.filter(l => selectedIds.has(l.id));

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

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Enriched Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage AI-enriched contact data</p>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <HeroMetric
          label="Total Enriched"
          value={metrics.isLoading ? "..." : formatNumber(metrics.totalEnriched)}
          icon={Sparkles}
        />
        <HeroMetric
          label="High Confidence"
          value={metrics.isLoading ? "..." : formatNumber(metrics.highConfidence)}
          subtitle="80%+ confidence score"
          icon={TrendingUp}
          status="success"
        />
        <HeroMetric
          label="Phone Discovered"
          value={metrics.isLoading ? "..." : formatNumber(metrics.phoneDiscovered)}
          icon={Phone}
        />
        <HeroMetric
          label="Email Verified"
          value={metrics.isLoading ? "..." : formatNumber(metrics.emailVerified)}
          icon={Mail}
          status="success"
        />
      </div>

      {/* Filters */}
      <EnrichedLeadsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
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
        onClearFilters={clearFilters}
      />

      {/* Header with bulk actions */}
      <EnrichedLeadsHeader
        selectedLeads={selectedLeads}
        allLeads={leads}
        orgId={orgId}
        onRefresh={refresh}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Table */}
      <EnrichedLeadsTable
        leads={leads}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onReEnrich={handleReEnrich}
        onViewDetails={setDetailLead}
      />

      {/* Detail Sheet */}
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
                    <p className="font-medium">{detailLead.enrichment_confidence ? `${(detailLead.enrichment_confidence * 100).toFixed(0)}%` : '-'}</p>
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
    </div>
  );
}
