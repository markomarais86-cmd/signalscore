import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Database, ExternalLink, AlertCircle, CheckCircle2, Download, TrendingUp, Sparkles } from "lucide-react";
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
import { PaginationControls } from "@/components/ui/pagination-controls";
import { EnrichmentDialog } from "@/components/EnrichmentDialog";
import { getSourceLabel, getSourceBadgeVariant } from "@/utils/data-source-attribution";
import { EmptyDataState } from "@/components/EmptyDataState";

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
  contacts?: any[];
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedAccountForScore, setSelectedAccountForScore] = useState<Account | null>(null);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedAccountsForEnrichment, setSelectedAccountsForEnrichment] = useState<string[]>([]);
  const [showEnrichmentDialog, setShowEnrichmentDialog] = useState(false);
  const [hasActiveICP, setHasActiveICP] = useState(false);
  const [needsScoring, setNeedsScoring] = useState(false);
  
  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAccountsForSummary, setTotalAccountsForSummary] = useState(0);
  const [summaryStats, setSummaryStats] = useState({
    withContacts: 0,
    avgQuality: 0,
    highFit: 0
  });
  
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadAccounts();
      loadSummaryStats();
    }
  }, [userProfile?.org_id, currentPage, pageSize, searchTerm, industryFilter]);

  const loadAccounts = async () => {
    if (!userProfile?.org_id) return;
    
    setLoading(true);
    try {
      // Build base query with filters
      let accountsQuery = supabase
        .from('accounts')
        .select('*', { count: 'exact' })
        .eq('org_id', userProfile.org_id);

      // Apply search filter
      if (searchTerm) {
        accountsQuery = accountsQuery.or(
          `name.ilike.%${searchTerm}%,domain.ilike.%${searchTerm}%,industry_raw.ilike.%${searchTerm}%`
        );
      }

      // Apply industry filter
      if (industryFilter !== "all") {
        accountsQuery = accountsQuery.eq('industry_norm', industryFilter);
      }

      // Get count and paginated data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data: accountsData, count, error: accountsError } = await accountsQuery
        .range(from, to)
        .order('name', { ascending: true });

      if (accountsError) throw accountsError;

      setTotalCount(count || 0);

      // Fetch scores and contacts for current page accounts only
      const accountExternalIds = (accountsData || []).map(a => a.external_id);
      
      const [{ data: scoresData }, { data: allContacts }, { data: icpData }] = await Promise.all([
        supabase
          .from('scores')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountExternalIds),
        supabase
          .from('contacts')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountExternalIds),
        supabase
          .from('icp_profiles')
          .select('id')
          .eq('org_id', userProfile.org_id)
          .eq('status', 'active')
      ]);

      const hasICP = (icpData?.length || 0) > 0;
      const hasScores = (scoresData?.length || 0) > 0;
      const hasAccounts = (accountsData?.length || 0) > 0;

      setHasActiveICP(hasICP);
      setNeedsScoring(hasAccounts && hasICP && !hasScores);

      // Create maps for quick lookups
      const scoresMap = new Map(
        (scoresData || []).map(score => [score.account_external_id, score])
      );

      const contactsMap = new Map<string, any[]>();
      (allContacts || []).forEach(contact => {
        const accountId = contact.account_external_id;
        if (!contactsMap.has(accountId)) {
          contactsMap.set(accountId, []);
        }
        contactsMap.get(accountId)!.push(contact);
      });

      // Combine accounts with scores and contacts
      const accountsWithContacts = (accountsData || []).map(account => {
        const scoreData = scoresMap.get(account.external_id);
        const contacts = contactsMap.get(account.external_id) || [];
        
        return {
          ...account,
          data_source: (account.data_source || 'crm') as 'crm' | 'database' | 'both',
          score: scoreData ? {
            overall: scoreData.overall,
            fit: scoreData.fit,
            intent: scoreData.intent,
            reachability: scoreData.reachability
          } : null,
          contacts
        };
      });

      setAccounts(accountsWithContacts);
      
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

  const loadSummaryStats = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const [
        { count: totalAccounts },
        { data: allScores },
        { data: accountsWithContactsData }
      ] = await Promise.all([
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id),
        supabase
          .from('scores')
          .select('overall')
          .eq('org_id', userProfile.org_id),
        supabase
          .from('contacts')
          .select('account_external_id')
          .eq('org_id', userProfile.org_id)
      ]);

      const uniqueAccountsWithContacts = new Set(
        (accountsWithContactsData || []).map(c => c.account_external_id)
      ).size;

      const highFitCount = (allScores || []).filter(s => s.overall >= 70).length;
      const avgQuality = 75; // Placeholder - would need to calculate from all accounts

      setTotalAccountsForSummary(totalAccounts || 0);
      setSummaryStats({
        withContacts: uniqueAccountsWithContacts,
        avgQuality,
        highFit: highFitCount
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

        const { data: contactsData } = await supabase
          .from('contacts')
          .select('account_external_id')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountIds);

        const scoresMap = new Map((scoresData || []).map(s => [s.account_external_id, s]));
        const contactsMap = new Map<string, number>();
        (contactsData || []).forEach(c => {
          contactsMap.set(c.account_external_id, (contactsMap.get(c.account_external_id) || 0) + 1);
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
          contacts: Array(contactsMap.get(account.external_id) || 0).fill({})
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

  const exportCSVData = (dataToExport: Account[], exportAll: boolean) => {

    // Define CSV headers
    const headers = [
      'Company Name',
      'Domain',
      'Industry (Normalized)',
      'Industry (Raw)',
      'Employee Count',
      'Revenue Range',
      'Country',
      'Overall Score',
      'Fit Score',
      'Intent Score',
      'Reachability Score',
      'Contact Count',
      'Data Completeness %',
      'External ID',
      'Last Updated'
    ];

    // Convert accounts to CSV rows
    const rows = dataToExport.map(account => [
      account.name || '',
      account.domain || '',
      account.industry_norm || '',
      account.industry_raw || '',
      account.employee_count || '',
      account.revenue_range || '',
      account.country || '',
      account.score?.overall || '',
      account.score?.fit || '',
      account.score?.intent || '',
      account.score?.reachability || '',
      account.contacts?.length || 0,
      calculateDataCompleteness(account),
      account.external_id,
      account.updated_at
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
    const filename = exportAll 
      ? `all_accounts_export_${new Date().toISOString().split('T')[0]}.csv`
      : `filtered_accounts_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${dataToExport.length} accounts to CSV`
    });
  };

  const [uniqueIndustries, setUniqueIndustries] = useState<string[]>([]);

  useEffect(() => {
    const fetchIndustries = async () => {
      if (!userProfile?.org_id) return;
      
      const { data } = await supabase
        .from('accounts')
        .select('industry_norm')
        .eq('org_id', userProfile.org_id)
        .not('industry_norm', 'is', null);
      
      const industries = Array.from(new Set((data || []).map(a => a.industry_norm).filter(Boolean)));
      setUniqueIndustries(industries);
    };
    
    fetchIndustries();
  }, [userProfile?.org_id]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccountsForSummary}</div>
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
              {summaryStats.withContacts}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalAccountsForSummary > 0 ? ((summaryStats.withContacts / totalAccountsForSummary) * 100).toFixed(1) : 0}% have contact data
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
              {summaryStats.avgQuality}%
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
              {summaryStats.highFit}
            </div>
            <p className="text-xs text-muted-foreground">Score 70+</p>
          </CardContent>
        </Card>
      </div>

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
          <CardTitle>All Accounts ({totalCount.toLocaleString()})</CardTitle>
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
                <TableHead>Contacts</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
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
                    <TableCell>
                      {account.external_database_match && account.data_source === 'database' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAccountsForEnrichment([account.id]);
                            setShowEnrichmentDialog(true);
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
              })}
            </TableBody>
          </Table>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalCount}
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

      <EnrichmentDialog
        open={showEnrichmentDialog}
        onOpenChange={setShowEnrichmentDialog}
        selectedAccounts={selectedAccountsForEnrichment}
        onEnrichmentComplete={() => {
          setShowEnrichmentDialog(false);
          loadAccounts();
        }}
      />
    </div>
  );
}
