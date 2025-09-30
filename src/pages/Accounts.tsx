import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Database, ExternalLink, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AITechnologyInsights } from "@/components/AITechnologyInsights";

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
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
  } | null;
  contacts?: any[];
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadAccounts();
    }
  }, [userProfile?.org_id]);

  useEffect(() => {
    filterAccounts();
  }, [accounts, searchTerm, industryFilter]);

  const loadAccounts = async () => {
    if (!userProfile?.org_id) return;
    
    setLoading(true);
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          *,
          scores!left (
            overall,
            fit,
            intent,
            reachability
          )
        `)
        .eq('org_id', userProfile.org_id)
        .order('name', { ascending: true });

      if (accountsError) throw accountsError;

      const accountsWithContacts = await Promise.all(
        (accountsData || []).map(async (account) => {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('org_id', userProfile.org_id)
            .eq('account_external_id', account.external_id);

          const scoreData = account.scores && Array.isArray(account.scores) && account.scores.length > 0 
            ? account.scores[0] 
            : null;
          
          return {
            ...account,
            score: scoreData && typeof scoreData === 'object' ? scoreData : null,
            contacts: contacts || []
          };
        })
      );

      setAccounts(accountsWithContacts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAccounts = () => {
    let filtered = accounts;

    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.industry_raw?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (industryFilter !== "all") {
      filtered = filtered.filter(account => account.industry_norm === industryFilter);
    }

    setFilteredAccounts(filtered);
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

  const exportToCSV = () => {
    if (filteredAccounts.length === 0) {
      toast({
        title: "No data to export",
        description: "No accounts match your current filters",
        variant: "destructive"
      });
      return;
    }

    // Define CSV headers
    const headers = [
      'Company Name',
      'Domain',
      'Industry',
      'Employee Count',
      'Revenue Range',
      'Country',
      'Overall Score',
      'Fit Score',
      'Intent Score',
      'Reachability Score',
      'Contact Count',
      'Data Completeness %',
      'External ID'
    ];

    // Convert accounts to CSV rows
    const rows = filteredAccounts.map(account => [
      account.name || '',
      account.domain || '',
      account.industry_norm || account.industry_raw || '',
      account.employee_count || '',
      account.revenue_range || '',
      account.country || '',
      account.score?.overall || '',
      account.score?.fit || '',
      account.score?.intent || '',
      account.score?.reachability || '',
      account.contacts?.length || 0,
      calculateDataCompleteness(account),
      account.external_id
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `accounts_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${filteredAccounts.length} accounts to CSV`
    });
  };

  const uniqueIndustries = Array.from(new Set(accounts.map(a => a.industry_norm).filter(Boolean)));

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Accounts</h1>
          <p className="text-muted-foreground mt-2">Complete CRM database view</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Accounts</h1>
          <p className="text-muted-foreground mt-2">Complete CRM database view</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">Companies in database</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Contacts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.filter(a => (a.contacts?.length || 0) > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((accounts.filter(a => (a.contacts?.length || 0) > 0).length / accounts.length) * 100)}% have contact data
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(accounts.reduce((sum, a) => sum + calculateDataCompleteness(a), 0) / accounts.length)}%
            </div>
            <p className="text-xs text-muted-foreground">Average completeness</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Fit Accounts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.filter(a => (a.score?.overall || 0) >= 70).length}
            </div>
            <p className="text-xs text-muted-foreground">Score 70+</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Technology Insights */}
      <AITechnologyInsights 
        accountIds={filteredAccounts.slice(0, 5).map(a => a.external_id)}
      />

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
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {uniqueIndustries.map(industry => (
                  <SelectItem key={industry} value={industry || ''}>{industry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts ({filteredAccounts.length})</CardTitle>
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
                <TableHead>Data Quality</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                const completeness = calculateDataCompleteness(account);
                return (
                  <Sheet key={account.id}>
                    <SheetTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
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
                          <div className="flex items-center gap-2">
                            <Progress value={completeness} className="w-16 h-2" />
                            <span className="text-sm">{completeness}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{account.contacts?.length || 0}</TableCell>
                        <TableCell>
                          {account.score?.overall ? (
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center justify-center w-14 h-14 rounded-lg font-bold text-lg ${
                                account.score.overall >= 80 ? 'bg-[hsl(var(--signal-high))]/20 text-[hsl(var(--signal-high))]' :
                                account.score.overall >= 60 ? 'bg-[hsl(var(--signal-medium))]/20 text-[hsl(var(--signal-medium))]' :
                                'bg-[hsl(var(--signal-low))]/20 text-[hsl(var(--signal-low))]'
                              }`}>
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
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No score</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </SheetTrigger>
                    <SheetContent className="w-[600px] sm:w-[700px]">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          {account.name || 'Unknown Company'}
                          {account.domain && (
                            <a
                              href={`https://${account.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </SheetTitle>
                        <SheetDescription>
                          Complete account information
                        </SheetDescription>
                      </SheetHeader>

                      <div className="space-y-6 mt-6">
                        {/* Data Completeness */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Data Quality</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span>Completeness:</span>
                              {getDataQualityBadge(completeness)}
                            </div>
                            <Progress value={completeness} />
                            <p className="text-sm text-muted-foreground">{completeness}% of fields populated</p>
                          </div>
                        </div>

                        {/* Account Details */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Account Details</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Industry</Label>
                              <p className="text-sm">{account.industry_norm || account.industry_raw || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Employees</Label>
                              <p className="text-sm">{account.employee_count || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Revenue</Label>
                              <p className="text-sm">{account.revenue_range || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Location</Label>
                              <p className="text-sm">{account.country || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Domain</Label>
                              <p className="text-sm">{account.domain || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">External ID</Label>
                              <p className="text-sm text-muted-foreground">{account.external_id}</p>
                            </div>
                          </div>
                        </div>

                        {/* ICP Score */}
                        {account.score && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">ICP Scoring</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Overall Score:</span>
                                <Badge variant={account.score.overall >= 70 ? "default" : "secondary"}>
                                  {account.score.overall}/100
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span>Fit:</span>
                                <span>{account.score.fit}/100</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Intent:</span>
                                <span>{account.score.intent}/100</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Reachability:</span>
                                <span>{account.score.reachability}/100</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Contacts */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Contacts ({account.contacts?.length || 0})</h3>
                          {account.contacts && account.contacts.length > 0 ? (
                            <div className="space-y-3">
                              {account.contacts.map((contact: any) => (
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
                      </div>
                    </SheetContent>
                  </Sheet>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
