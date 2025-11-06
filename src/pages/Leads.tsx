import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter, CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp, Download, Info } from "lucide-react";
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
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { LeadAccountMatcher } from "@/components/data-upload/LeadAccountMatcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, AlertTriangle } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";

export default function Leads() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [personaFilter, setPersonaFilter] = useState("all");
  const [showMatcher, setShowMatcher] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [hasAttemptedMatch, setHasAttemptedMatch] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { flags } = useFeatureFlags();

  // Use infinite scroll hook
  const {
    leads,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh
  } = useInfiniteLeads({
    orgId: userProfile?.org_id || null,
    pageSize: 25,
    searchTerm,
    statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
    linkFilter: linkFilter !== 'all' ? linkFilter : undefined,
    personaFilter: personaFilter !== 'all' ? personaFilter : undefined
  });

  // Set up infinite scroll observer
  const { observerTarget } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore
  });

  // Removed auto-match on page load - it causes timeouts and poor UX

  const handleAutoMatch = async () => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "No organization ID found",
        variant: "destructive",
      });
      return;
    }

    setIsMatching(true);
    
    try {
      console.log('Starting fast SQL-based lead-to-account matching...');
      
      toast({
        title: "Matching Leads...",
        description: "This will take just a few seconds.",
      });
      
      // Call the fast SQL function directly
      const { data, error } = await supabase.rpc('match_leads_to_accounts_fast', {
        p_org_id: userProfile.org_id
      });

      if (error) {
        console.error('SQL function error:', error);
        throw error;
      }

      console.log('Matching result:', data);
      
      const result = data as { success: boolean; total_linked: number; matched_to_existing: number; new_accounts_created: number; failed: number };
      
      if (result.success) {
        toast({
          title: "✓ Leads Matched Successfully",
          description: `${result.total_linked.toLocaleString()} leads linked (${result.matched_to_existing.toLocaleString()} matched to existing accounts, ${result.new_accounts_created.toLocaleString()} new accounts created)`,
        });
        
        // Reload leads to show updated data
        await refresh();
      } else {
        throw new Error('Matching failed');
      }
    } catch (error) {
      console.error('Error matching leads:', error);
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
        refresh();
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

  if ((isLoading && leads.length === 0) || isMatching) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Leads</h1>
          <p className="text-muted-foreground mt-2">Manage and qualify your account pipeline</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="space-y-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              {isMatching && (
                <p className="text-sm text-muted-foreground">
                  Linking leads to accounts... This may take a moment.
                </p>
              )}
            </div>
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
    if (leads.length === 0) {
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

    const rows = leads.map(lead => {
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
      description: `Exported ${leads.length} leads to CSV`
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

      {/* Info: Leads auto-match on upload */}
      {!flags.demo_mode && unlinkedLeads.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <strong>Note:</strong> You have {unlinkedLeads.length.toLocaleString()} unlinked leads. 
            </div>
            <div className="text-sm">
              <p>Leads are automatically matched to accounts and scored when you upload them via CSV. These unlinked leads may be from older uploads.</p>
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
                'Match Unlinked Leads'
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
              <strong>{unlinkedLeads.length.toLocaleString()} leads still unlinked after auto-matching.</strong>
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
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Qualified Leads ({totalCount.toLocaleString()})</CardTitle>
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
                <TableHead>Persona</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ICP Score</TableHead>
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

          {leads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No leads match your current filters" 
                  : "No leads found. Upload some data to get started."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}