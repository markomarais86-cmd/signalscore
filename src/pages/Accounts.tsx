import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Database, ExternalLink, AlertCircle, CheckCircle2, Download, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Progress } from "@/components/ui/progress";
import { ScoreBreakdownDialog } from "@/components/scoring/ScoreBreakdownDialog";
import { AccountDetailDrawer } from "@/components/accounts/AccountDetailDrawer";
import { BulkScoring } from "@/components/BulkScoring";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { DEMO_ACCOUNTS } from "@/data/mockData";

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
  const [selectedAccountForScore, setSelectedAccountForScore] = useState<Account | null>(null);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();
  const { flags } = useFeatureFlags();

  // Pagination
  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedData,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination({ data: filteredAccounts, initialPageSize: 25 });

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
      // Demo mode: use mock data
      if (flags.demo_mode) {
        setAccounts(DEMO_ACCOUNTS as any);
        setLoading(false);
        return;
      }

      // Real data mode
      // Fetch accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('name', { ascending: true });

      if (accountsError) throw accountsError;

      // Fetch scores separately (no foreign key relationship exists)
      const { data: scoresData } = await supabase
        .from('scores')
        .select('*')
        .eq('org_id', userProfile.org_id);

      // Create a map for quick score lookup
      const scoresMap = new Map(
        (scoresData || []).map(score => [score.account_external_id, score])
      );

      // Combine accounts with scores and contacts
      const accountsWithContacts = await Promise.all(
        (accountsData || []).map(async (account) => {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('org_id', userProfile.org_id)
            .eq('account_external_id', account.external_id);

          const scoreData = scoresMap.get(account.external_id);
          
          return {
            ...account,
            score: scoreData ? {
              overall: scoreData.overall,
              fit: scoreData.fit,
              intent: scoreData.intent,
              reachability: scoreData.reachability
            } : null,
            contacts: contacts || []
          };
        })
      );

      setAccounts(accountsWithContacts);
      
      // Mark step complete if we have scores
      if (accountsWithContacts.some(a => a.score !== null)) {
        completeStep('view_scores');
      }
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
      <DemoModeBanner />
      
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
              {((accounts.filter(a => (a.contacts?.length || 0) > 0).length / accounts.length) * 100).toFixed(2)}% have contact data
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
              {(accounts.reduce((sum, a) => sum + calculateDataCompleteness(a), 0) / accounts.length).toFixed(2)}%
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

      {/* Bulk Scoring */}
      <BulkScoring onComplete={loadAccounts} />

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
              {paginatedData.map((account) => {
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
                      <div className="flex items-center gap-2">
                        <Progress value={completeness} className="w-16 h-2" />
                        <span className="text-sm">{completeness.toFixed(2)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{account.contacts?.length || 0}</TableCell>
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredAccounts.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
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
            reachability_factors: selectedAccountForScore.contacts && selectedAccountForScore.contacts.length > 0 ? [`${selectedAccountForScore.contacts.length} contacts available`] : ['No contacts available']
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
    </div>
  );
}
