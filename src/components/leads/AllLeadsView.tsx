import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Lead } from "@/hooks/use-infinite-leads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, CheckCircle, XCircle, ExternalLink, TrendingUp, Download, Info, Linkedin, AlertCircle, HelpCircle, Target } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/utils/format-numbers";
import { Label } from "@/components/ui/label";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, AlertTriangle, Users } from "lucide-react";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { WelcomeEmptyState } from "@/components/onboarding/WelcomeEmptyState";


interface AllLeadsViewProps {
  leads: Lead[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
  lastError: Error | null;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  linkFilter: string;
  setLinkFilter: (v: string) => void;
  personaFilter: string;
  setPersonaFilter: (v: string) => void;
  campaignReadyFilter: string;
  setCampaignReadyFilter: (v: string) => void;
  icpFilter: string;
  setIcpFilter: (v: string) => void;
  isMatching: boolean;
  handleAutoMatch: () => void;
  handleRescore: (lead: Lead) => void;
  hasAttemptedMatch: boolean;
  showMatcher: boolean;
  setShowMatcher: (v: boolean) => void;
  metrics: any;
  metricsLoading: boolean;
  demoMode: boolean;
  observerTarget: React.RefObject<any>;
  effectiveOrgId: string | null;
}

export function AllLeadsView({
  leads, isLoading, isLoadingMore, hasMore, totalCount, loadMore, refresh, retry, lastError,
  searchTerm, setSearchTerm, statusFilter, setStatusFilter, linkFilter, setLinkFilter,
  personaFilter, setPersonaFilter, campaignReadyFilter, setCampaignReadyFilter,
  icpFilter, setIcpFilter, isMatching, handleAutoMatch, handleRescore,
  hasAttemptedMatch, showMatcher, setShowMatcher, metrics, metricsLoading,
  demoMode, observerTarget, effectiveOrgId
}: AllLeadsViewProps) {
  const icpQualifiedCount = metrics?.icp_qualified_count ?? 0;
  const campaignReadyCount = metrics?.campaign_ready_count ?? 0;
  const enrichedCount = metrics?.enriched_count ?? 0;
  const linkedCount = metrics?.linked_to_accounts_count ?? 0;
  const totalLeadsCount = metrics?.total_leads ?? 0;
  const unlinkedLeads = leads.filter(lead => !lead.account_external_id);
  const unlinkedPercentage = totalLeadsCount > 0 ? Math.round(((totalLeadsCount - linkedCount) / totalLeadsCount) * 100) : 0;

  const csvHeaders = useMemo(() => [
    'Name','First Name','Last Name','Email','Phone','Title','Persona','Campaign Ready',
    'Company','Website','Industry','Employee Count','Revenue Range','Country','State/Province',
    'Status','Overall Score','Fit Score','Account Link','External ID'
  ], []);

  const exportToCSV = useCallback(() => {
    if (leads.length === 0) return;
    const rows = leads.map(lead => {
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
      const isCampaignReady = lead.email && lead.title && lead.persona && lead.persona !== 'Unknown';
      return [
        fullName || lead.name || '', lead.first_name || '', lead.last_name || '',
        lead.email || '', lead.phone || lead.mobile || '', lead.title || '',
        lead.persona || '', isCampaignReady ? 'Yes' : 'No', lead.company || '',
        lead.website || '', lead.industry || '', lead.employee_count || '',
        lead.revenue_range || '', lead.country || '', lead.state_province || '',
        lead.status || '', lead.score?.overall || '', lead.score?.fit || '',
        lead.account_external_id ? 'Yes' : 'No', lead.external_id
      ];
    });
    const csvContent = [csvHeaders.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [leads, csvHeaders]);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {!demoMode && unlinkedLeads.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div><strong>Note:</strong> You have {formatNumber(unlinkedLeads.length)} leads without account links.</div>
            <div className="text-sm"><p>Leads are automatically matched to accounts when uploaded via CSV.</p></div>
            <Button onClick={handleAutoMatch} disabled={isMatching} size="sm">
              {isMatching ? <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />Matching...</> : 'Link to Accounts'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!demoMode && unlinkedLeads.length > 0 && unlinkedPercentage >= 10 && hasAttemptedMatch && (
        <Alert className="border-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <strong>{formatNumber(unlinkedLeads.length)} leads still unlinked after auto-matching.</strong>
              <p className="text-sm mt-1">These leads may be missing email/website data needed for account matching.</p>
            </div>
            <Button onClick={handleAutoMatch} size="sm" disabled={isMatching}>
              <Link2 className="h-4 w-4 mr-2" />Retry Matching
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {(totalLeadsCount > 0 || metricsLoading) && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <HeroMetric label="ICP Qualified" value={metricsLoading ? "..." : formatNumber(icpQualifiedCount)}
            subtitle={`${totalLeadsCount > 0 ? Math.round((icpQualifiedCount / totalLeadsCount) * 100) : 0}% of ${formatNumber(totalLeadsCount)} leads`}
            icon={CheckCircle} status="success" />
          <HeroMetric label="Campaign Ready" value={metricsLoading ? "..." : formatNumber(campaignReadyCount)}
            subtitle="Has email, title & persona" icon={Target} />
          <HeroMetric label="Enriched" value={metricsLoading ? "..." : formatNumber(enrichedCount)}
            subtitle={`${totalLeadsCount > 0 ? Math.round((enrichedCount / totalLeadsCount) * 100) : 0}% processed`}
            icon={TrendingUp} />
          <HeroMetric label="Linked to Accounts" value={metricsLoading ? "..." : formatNumber(linkedCount)}
            subtitle={`${totalLeadsCount > 0 ? Math.round((linkedCount / totalLeadsCount) * 100) : 0}% of all leads`}
            icon={ExternalLink} />
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter & Search</CardTitle>
          <CardDescription><strong>Campaign Ready</strong> = Contact has email, title, and persona (not Unknown)</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads by name, company, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="nurturing">Nurturing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={linkFilter} onValueChange={setLinkFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Account link" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="linked">Linked to Account</SelectItem>
                <SelectItem value="unlinked">Unlinked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={personaFilter} onValueChange={setPersonaFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filter by persona" /></SelectTrigger>
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
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Campaign ready" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="ready">Campaign Ready</SelectItem>
                <SelectItem value="not_ready">Not Ready</SelectItem>
              </SelectContent>
            </Select>
            <Select value={icpFilter} onValueChange={setIcpFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="ICP Status" /></SelectTrigger>
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
          <CardDescription>All contacts linked to accounts - Use filters to find campaign-ready leads</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {/* Mobile card view */}
          <div className="block md:hidden space-y-3">
            {leads.map((lead) => {
              const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || 'Unknown Lead';
              const isCampaignReady = lead.email && lead.title && lead.persona && lead.persona !== 'Unknown';
              return (
                <Card key={lead.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{fullName}</p>
                      <p className="text-sm text-muted-foreground">{lead.title || '-'}</p>
                    </div>
                    {isCampaignReady ? (
                      <Badge className="bg-[hsl(var(--signal-high))] shrink-0"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0"><XCircle className="h-3 w-3 mr-1" />Incomplete</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{lead.company || '-'} · {lead.country || '-'}</p>
                  {lead.email && <p className="text-xs text-muted-foreground mt-1 truncate">{lead.email}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {lead.persona && lead.persona !== 'Unknown' && <Badge variant="secondary" className="text-xs">{lead.persona}</Badge>}
                    {lead.enriched_at && lead.icp_qualified === true && <Badge className="bg-[hsl(var(--signal-high))] text-xs">ICP ✓</Badge>}
                    {lead.enrichment_overall_score !== null && (
                      <Badge variant="outline" className="text-xs">{lead.enrichment_overall_score}/20</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block">
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
                  return (
                    <Sheet key={lead.id}>
                      <SheetTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <div className="font-medium">{fullName}</div>
                              {lead.phone && <div className="text-sm text-muted-foreground">{lead.phone}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div>{lead.company || '-'}</div>
                              {lead.website && <div className="text-sm text-muted-foreground">{lead.website}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{lead.title || '-'}</TableCell>
                          <TableCell>
                            {lead.persona && lead.persona !== 'Unknown' ? (
                              <Badge variant={lead.persona.includes('Decision Maker') ? 'default' : lead.persona.includes('Influencer') ? 'secondary' : 'outline'}>
                                {lead.persona}
                              </Badge>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              {lead.enriched_at ? (
                                lead.icp_qualified === true ? (
                                  <Badge className="bg-[hsl(var(--signal-high))]"><CheckCircle className="h-3 w-3 mr-1" />ICP Qualified</Badge>
                                ) : lead.icp_qualified === false ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="destructive" className="cursor-help"><XCircle className="h-3 w-3 mr-1" />ICP Failed</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-medium mb-1">Fail Reasons:</p>
                                      <ul className="text-xs space-y-1">{(lead.icp_fail_reasons || []).map((r, i) => <li key={i}>• {r}</li>)}</ul>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : <Badge variant="secondary">Pending</Badge>
                              ) : <Badge variant="outline" className="text-muted-foreground">Not Enriched</Badge>}
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            {lead.enrichment_overall_score !== null ? (
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${
                                  lead.enrichment_overall_score >= 15 ? 'text-[hsl(var(--signal-high))]' :
                                  lead.enrichment_overall_score >= 10 ? 'text-[hsl(var(--signal-medium))]' :
                                  'text-[hsl(var(--signal-low))]'
                                }`}>{lead.enrichment_overall_score}/20</span>
                                {lead.linkedin_url && (
                                  <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#0077b5] hover:text-[#005885]" onClick={e => e.stopPropagation()}>
                                    <Linkedin className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div>{lead.country || '-'}</div>
                              {lead.state_province && <div className="text-sm text-muted-foreground">{lead.state_province}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.email && lead.title && lead.persona && lead.persona !== 'Unknown' ? (
                              <Badge className="bg-[hsl(var(--signal-high))]"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>
                            ) : (
                              <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Incomplete</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:w-[540px] md:w-[640px] overflow-y-auto">
                        <LeadDetailPanel lead={lead} handleRescore={handleRescore} />
                      </SheetContent>
                    </Sheet>
                  );
                })}
              </TableBody>
            </Table>
          </div>

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
                <div className="text-center py-12"><p className="text-muted-foreground">No leads match your current filters</p></div>
              ) : (
                <WelcomeEmptyState highlightStep="upload_data" compact />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function LeadDetailPanel({ lead, handleRescore }: { lead: Lead; handleRescore: (l: Lead) => void }) {
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || 'Unknown Lead';
  const statusVariant = lead.status === 'qualified' ? 'default' as const : lead.status === 'open' ? 'secondary' as const : 'outline' as const;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {fullName}
          {lead.website && (
            <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </SheetTitle>
        <SheetDescription>Lead Details {lead.status === 'qualified' && '- Qualified Lead'}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 mt-6 pb-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Lead Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label className="text-sm font-medium">Email</Label><p className="text-sm break-all">{lead.email || '-'}</p></div>
            <div><Label className="text-sm font-medium">Phone</Label><p className="text-sm">{lead.phone || lead.mobile || '-'}</p></div>
            <div><Label className="text-sm font-medium">Title</Label><p className="text-sm">{lead.title || '-'}</p></div>
            <div><Label className="text-sm font-medium">Persona</Label>
              <div>{lead.persona && lead.persona !== 'Unknown' ? (
                <Badge variant={lead.persona.includes('Decision Maker') ? 'default' : lead.persona.includes('Influencer') ? 'secondary' : 'outline'}>{lead.persona}</Badge>
              ) : <span className="text-sm text-muted-foreground">-</span>}</div>
            </div>
            <div><Label className="text-sm font-medium">Status</Label><Badge variant={statusVariant}>{lead.status || 'open'}</Badge></div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Company Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label className="text-sm font-medium">Company</Label><p className="text-sm truncate">{lead.company || '-'}</p></div>
            <div><Label className="text-sm font-medium">Website</Label><p className="text-sm">{lead.website || '-'}</p></div>
            <div><Label className="text-sm font-medium">Industry</Label><p className="text-sm">{lead.industry || '-'}</p></div>
            <div><Label className="text-sm font-medium">Employees</Label><p className="text-sm">{lead.employee_count || '-'}</p></div>
            <div><Label className="text-sm font-medium">Revenue</Label><p className="text-sm">{lead.revenue_range || '-'}</p></div>
            <div><Label className="text-sm font-medium">Location</Label><p className="text-sm">{lead.country || '-'}</p></div>
          </div>
        </div>

        {lead.enriched_at && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <LaunchPulseMark className="h-5 w-5" />Enrichment Data
            </h3>
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${
                lead.icp_qualified === true ? 'bg-[hsl(var(--signal-high))]/10 border-[hsl(var(--signal-high))]/30' :
                lead.icp_qualified === false ? 'bg-destructive/10 border-destructive/30' : 'bg-muted'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">ICP Qualification:</span>
                  {lead.icp_qualified === true ? (
                    <Badge className="bg-[hsl(var(--signal-high))]"><CheckCircle className="h-3 w-3 mr-1" />Qualified</Badge>
                  ) : lead.icp_qualified === false ? (
                    <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Not Qualified</Badge>
                  ) : <Badge variant="secondary">Pending</Badge>}
                </div>
                {lead.icp_fail_reasons && lead.icp_fail_reasons.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-destructive/20">
                    <p className="text-sm text-muted-foreground mb-1">Fail Reasons:</p>
                    <ul className="text-sm space-y-1">
                      {lead.icp_fail_reasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" /><span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Quality Score</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-2xl font-bold ${
                      (lead.enrichment_overall_score || 0) >= 15 ? 'text-[hsl(var(--signal-high))]' :
                      (lead.enrichment_overall_score || 0) >= 10 ? 'text-[hsl(var(--signal-medium))]' :
                      'text-[hsl(var(--signal-low))]'
                    }`}>{lead.enrichment_overall_score || 0}/20</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Still at Company</Label>
                  <p className="text-sm mt-1">
                    {lead.still_at_company === 'yes' ? <Badge className="bg-[hsl(var(--signal-high))]">Confirmed</Badge> :
                     lead.still_at_company === 'no' ? <Badge variant="destructive">Left Company</Badge> :
                     <span className="text-muted-foreground">Unknown</span>}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">LinkedIn</Label>
                  {lead.linkedin_url ? (
                    <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#0077b5] hover:underline mt-1">
                      <Linkedin className="h-4 w-4" />View Profile
                    </a>
                  ) : <p className="text-sm text-muted-foreground mt-1">-</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium">Direct Phone</Label>
                  <p className="text-sm mt-1">{lead.direct_phone || '-'}</p>
                </div>
              </div>

              {lead.enrichment_field_scores && Object.keys(lead.enrichment_field_scores).length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Field Quality Scores</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(lead.enrichment_field_scores).map(([field, score]) => (
                      <div key={field} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                        <span className="capitalize">{field.replace(/_/g, ' ')}</span>
                        <span className={`font-medium ${
                          (score as number) >= 3 ? 'text-[hsl(var(--signal-high))]' :
                          (score as number) >= 2 ? 'text-[hsl(var(--signal-medium))]' : 'text-[hsl(var(--signal-low))]'
                        }`}>{score as number}/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!lead.enriched_at && lead.score && lead.account_external_id && (
          <div>
            <h3 className="text-lg font-semibold mb-3">ICP Qualification Score</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-[hsl(var(--signal-high))]/10 rounded-lg">
                <span className="font-medium">Overall ICP Score:</span>
                <Badge className="bg-[hsl(var(--signal-high))] text-lg">{lead.score.overall}/100</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['fit', 'intent', 'reachability'] as const).map(key => (
                  <div key={key} className="text-center p-2 border rounded">
                    <div className="text-sm text-muted-foreground capitalize">{key === 'reachability' ? 'Reach' : key}</div>
                    <div className="text-xl font-bold">{lead.score![key]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!lead.enriched_at && !lead.score && (
          <div>
            <h3 className="text-lg font-semibold mb-3">ICP Status</h3>
            <div className="p-4 bg-muted rounded-lg text-center">
              <LaunchPulseMark className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">This lead has not been enriched yet. Run lead enrichment to get ICP qualification and quality scores.</p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <Button className="w-full justify-start"><CheckCircle className="h-4 w-4 mr-2" />Add to Outreach Sequence</Button>
            {lead.account_external_id && (
              <Button variant="outline" className="w-full justify-start"><ExternalLink className="h-4 w-4 mr-2" />View Full Account Details</Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
