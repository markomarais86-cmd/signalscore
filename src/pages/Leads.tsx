import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter, CheckCircle, XCircle, RotateCcw, ExternalLink, TrendingUp } from "lucide-react";
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
  domain: string | null;
  industry_raw: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  updated_at: string;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
    reasons: any;
  } | null;
  contacts?: Contact[];
}

interface Contact {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title_raw: string | null;
  persona: string | null;
  level: string | null;
  country: string | null;
}

import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
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
  }, [leads, searchTerm, statusFilter]);

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
          domain: account.domain,
          industry_raw: account.industry_raw,
          industry_norm: account.industry_norm,
          employee_count: account.employee_count,
          revenue_range: account.revenue_range,
          country: account.country,
          updated_at: new Date().toISOString(),
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
          },
          contacts: account.contacts.map(contact => ({
            id: contact.id,
            external_id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            title_raw: contact.title_raw,
            persona: null,
            level: null,
            country: account.country
          }))
        }));
        setLeads(demoLeads);
        setLoading(false);
        return;
      }

      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('updated_at', { ascending: false });

      if (accountsError) throw accountsError;

      // Load scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('overall, fit, intent, reachability, reasons, account_external_id')
        .eq('org_id', userProfile.org_id);

      if (scoresError) throw scoresError;

      // Join accounts with their scores
      const accountsWithScores = (accountsData || []).map(account => ({
        ...account,
        scores: (scoresData || []).filter(score => 
          score.account_external_id === account.external_id
        )
      }));

      // Load contacts for each account
      const leadsWithContacts = await Promise.all(
        (accountsWithScores || []).map(async (account) => {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('org_id', userProfile.org_id)
            .eq('account_external_id', account.external_id);

          // Transform the account data to match Lead interface
          const scoreData = account.scores && Array.isArray(account.scores) && account.scores.length > 0 
            ? account.scores[0] 
            : null;
          
          const lead: Lead = {
            id: account.id,
            external_id: account.external_id,
            name: account.name,
            domain: account.domain,
            industry_raw: account.industry_raw,
            industry_norm: account.industry_norm,
            employee_count: account.employee_count,
            revenue_range: account.revenue_range,
            country: account.country,
            updated_at: account.updated_at,
            score: scoreData && typeof scoreData === 'object' && scoreData.overall !== undefined ? {
              overall: scoreData.overall,
              fit: scoreData.fit,
              intent: scoreData.intent,
              reachability: scoreData.reachability,
              reasons: scoreData.reasons
            } : null,
            contacts: contacts || []
          };

          return lead;
        })
      );

      setLeads(leadsWithContacts);
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
    // Only show high-scoring accounts (70+)
    let filtered = leads.filter(lead => (lead.score?.overall || 0) >= 70);

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.industry_raw?.toLowerCase().includes(searchTerm.toLowerCase())
      );
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
            industry: lead.industry_norm,
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

  return (
    <div className="space-y-6">
      <DemoModeBanner />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Leads</h1>
          <p className="text-muted-foreground mt-2">High-signal opportunities (ICP score ≥70)</p>
        </div>
      </div>

      {/* Hero Metric */}
      {leads.length > 0 && (
        <HeroMetric
          label="High-Signal Accounts"
          value={highSignalLeads.length}
          subtitle={`${Math.round((highSignalLeads.length / leads.length) * 100)}% of total pipeline`}
          icon={TrendingUp}
          trend={{ value: 8, period: 'last week' }}
          status={highSignalLeads.length > 0 ? 'success' : 'warning'}
        />
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search qualified leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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
                <TableHead>Account</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>ICP Score</TableHead>
                <TableHead>Fit Breakdown</TableHead>
                <TableHead>Contacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((lead) => (
                <Sheet key={lead.id}>
                  <SheetTrigger asChild>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{lead.name || 'Unknown Company'}</div>
                          <div className="text-sm text-muted-foreground">{lead.domain}</div>
                        </div>
                      </TableCell>
                      <TableCell>{lead.industry_norm || lead.industry_raw}</TableCell>
                      <TableCell>
                        <div>
                          <div>{lead.employee_count ? `${lead.employee_count} employees` : '-'}</div>
                          <div className="text-sm text-muted-foreground">{lead.revenue_range}</div>
                        </div>
                      </TableCell>
                      <TableCell>{lead.country}</TableCell>
                      <TableCell>
                        <Badge className="bg-success">{lead.score?.overall || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            F: {lead.score?.fit || 0}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            I: {lead.score?.intent || 0}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            R: {lead.score?.reachability || 0}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{lead.contacts?.length || 0}</TableCell>
                    </TableRow>
                  </SheetTrigger>
                  <SheetContent className="w-[600px] sm:w-[700px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        {lead.name || 'Unknown Company'}
                        {lead.domain && (
                          <a
                            href={`https://${lead.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </SheetTitle>
                      <SheetDescription>
                        Qualified lead - High ICP match score
                      </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6 mt-6">
                      {/* Account Overview */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Account Overview</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Industry</Label>
                            <p className="text-sm">{lead.industry_norm || lead.industry_raw || '-'}</p>
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
                      {lead.score && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Why This Lead Qualifies</h3>
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
                      )}

                      {/* Contacts */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Contacts ({lead.contacts?.length || 0})</h3>
                        {lead.contacts && lead.contacts.length > 0 ? (
                          <div className="space-y-3">
                            {lead.contacts.map((contact) => (
                              <Card key={contact.id}>
                                <CardContent className="pt-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium">
                                        {contact.first_name} {contact.last_name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">{contact.title_raw}</p>
                                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                                    </div>
                                    <div className="text-right">
                                      {contact.persona && (
                                        <Badge variant="outline" className="mb-1">
                                          {contact.persona}
                                        </Badge>
                                      )}
                                      {contact.level && (
                                        <p className="text-xs text-muted-foreground">{contact.level}</p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No contacts found for this account</p>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-4 border-t">
                        <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
                        <div className="flex flex-col gap-2">
                          <Button className="w-full justify-start">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Add to Outreach Sequence
                          </Button>
                          <Button variant="outline" className="w-full justify-start">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Full Account in CRM
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              ))}
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