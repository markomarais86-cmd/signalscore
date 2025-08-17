import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter, CheckCircle, XCircle, RotateCcw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface Lead {
  id: string;
  external_id: string;
  name: string;
  domain: string;
  industry_raw: string;
  industry_norm: string;
  employee_count: number;
  revenue_range: string;
  country: string;
  updated_at: string;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
    reasons: any;
  };
  contacts?: Contact[];
}

interface Contact {
  id: string;
  external_id: string;
  first_name: string;
  last_name: string;
  email: string;
  title_raw: string;
  persona: string;
  level: string;
  country: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();

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
      // Load accounts with their scores
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          *,
          scores!left (
            overall,
            fit,
            intent,
            reachability,
            reasons
          )
        `)
        .eq('org_id', userProfile.org_id)
        .order('updated_at', { ascending: false });

      if (accountsError) throw accountsError;

      // Load contacts for each account
      const leadsWithContacts = await Promise.all(
        (accountsData || []).map(async (account) => {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('org_id', userProfile.org_id)
            .eq('account_external_id', account.external_id);

          return {
            ...account,
            score: account.scores?.[0] || null,
            contacts: contacts || []
          };
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
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.industry_raw?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(lead => {
        const score = lead.score?.overall || 0;
        switch (statusFilter) {
          case "qualified":
            return score >= 70;
          case "unqualified":
            return score < 70 && score > 0;
          case "unscored":
            return score === 0 || !lead.score;
          default:
            return true;
        }
      });
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Manage and qualify your account pipeline</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="qualified">Qualified (≥70)</SelectItem>
                <SelectItem value="unqualified">Scored (<70)</SelectItem>
                <SelectItem value="unscored">Unscored</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts ({filteredLeads.length})</CardTitle>
          <CardDescription>
            Click on any row to view detailed account information
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
                <TableHead>Score</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
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
                      <TableCell>{getScoreBadge(lead.score?.overall)}</TableCell>
                      <TableCell>{lead.contacts?.length || 0}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRescore(lead);
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TableCell>
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
                        Account details and contact information
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

                      {/* Scoring */}
                      {lead.score && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Scoring Breakdown</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Overall Score:</span>
                              <Badge variant={lead.score.overall >= 70 ? "default" : "secondary"}>
                                {lead.score.overall}/100
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Fit:</span>
                              <span>{lead.score.fit}/100</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Intent:</span>
                              <span>{lead.score.intent}/100</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Reachability:</span>
                              <span>{lead.score.reachability}/100</span>
                            </div>
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

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button 
                          variant="default"
                          onClick={() => handleRescore(lead)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Rescore Account
                        </Button>
                        <Button variant="outline">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Qualify
                        </Button>
                        <Button variant="outline">
                          <XCircle className="h-4 w-4 mr-2" />
                          Disqualify
                        </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}