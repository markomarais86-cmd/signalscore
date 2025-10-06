import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Download, Target, Users, Filter, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getSourceBadgeVariant, getSourceLabel } from "@/utils/data-source-attribution";

interface FilterState {
  icpScore: string;
  jobTitles: string[];
  seniorityLevels: string[];
  industries: string[];
  geographies: string[];
  companySizes: string[];
  dataSource: string;
}

interface CampaignAccount {
  external_id: string;
  name: string;
  domain: string;
  industry_norm: string;
  employee_count: number;
  country: string;
  data_source: 'crm' | 'database' | 'both';
  score?: number;
  contacts_count?: number;
}

export default function CampaignBuilder() {
  const [filters, setFilters] = useState<FilterState>({
    icpScore: 'all',
    jobTitles: [],
    seniorityLevels: [],
    industries: [],
    geographies: [],
    companySizes: [],
    dataSource: 'all'
  });

  const [matchedAccounts, setMatchedAccounts] = useState<CampaignAccount[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [availableFilters, setAvailableFilters] = useState({
    jobTitles: [] as string[],
    seniorityLevels: [] as string[],
    industries: [] as string[],
    geographies: [] as string[],
    companySizes: [] as string[]
  });

  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadAvailableFilters();
  }, [userProfile?.org_id]);

  useEffect(() => {
    if (userProfile?.org_id) {
      applyFilters();
    }
  }, [filters, userProfile?.org_id]);

  const loadAvailableFilters = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Load unique values for filters from contacts and accounts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('title_raw, level')
        .eq('org_id', userProfile.org_id);

      const { data: accounts } = await supabase
        .from('accounts')
        .select('industry_norm, country, employee_count')
        .eq('org_id', userProfile.org_id);

      // Extract unique values
      const jobTitles = [...new Set(contacts?.map(c => c.title_raw).filter(Boolean) || [])];
      const seniorityLevels = [...new Set(contacts?.map(c => c.level).filter(Boolean) || [])];
      const industries = [...new Set(accounts?.map(a => a.industry_norm).filter(Boolean) || [])];
      const geographies = [...new Set(accounts?.map(a => a.country).filter(Boolean) || [])];
      
      // Categorize company sizes
      const sizes = ['1-50', '51-200', '201-1000', '1001-5000', '5000+'];

      setAvailableFilters({
        jobTitles: jobTitles.sort(),
        seniorityLevels: ['C-Level', 'VP', 'Director', 'Manager', 'Individual Contributor'],
        industries: industries.sort(),
        geographies: geographies.sort(),
        companySizes: sizes
      });
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const applyFilters = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('accounts')
        .select(`
          external_id,
          name,
          domain,
          industry_norm,
          employee_count,
          country,
          data_source,
          external_database_match
        `)
        .eq('org_id', userProfile.org_id)
        .limit(100000); // Remove default 1000 limit

      // Apply ICP score filter
      if (filters.icpScore !== 'all') {
        const { data: scores } = await supabase
          .from('scores')
          .select('account_external_id, overall')
          .eq('org_id', userProfile.org_id);

        let filteredAccountIds: string[] = [];
        if (filters.icpScore === 'high') {
          filteredAccountIds = scores?.filter(s => s.overall >= 70).map(s => s.account_external_id) || [];
        } else if (filters.icpScore === 'medium') {
          filteredAccountIds = scores?.filter(s => s.overall >= 40 && s.overall < 70).map(s => s.account_external_id) || [];
        }

        if (filteredAccountIds.length > 0) {
          query = query.in('external_id', filteredAccountIds);
        }
      }

      // Apply industry filter
      if (filters.industries.length > 0) {
        query = query.in('industry_norm', filters.industries);
      }

      // Apply geography filter
      if (filters.geographies.length > 0) {
        query = query.in('country', filters.geographies);
      }

      // Apply data source filter
      if (filters.dataSource === 'crm') {
        query = query.eq('data_source', 'crm');
      } else if (filters.dataSource === 'database') {
        query = query.eq('data_source', 'database');
      }

      const { data: accounts, error } = await query;

      if (error) throw error;

      // Get scores for matched accounts
      const accountIds = accounts?.map(a => a.external_id) || [];
      const { data: scores } = await supabase
        .from('scores')
        .select('account_external_id, overall')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', accountIds);

      const scoresMap = new Map(scores?.map(s => [s.account_external_id, s.overall]) || []);

      // Get contact counts
      const { data: contactCounts } = await supabase
        .from('contacts')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', accountIds);

      const contactCountsMap = new Map<string, number>();
      contactCounts?.forEach(c => {
        const count = contactCountsMap.get(c.account_external_id) || 0;
        contactCountsMap.set(c.account_external_id, count + 1);
      });

      const enrichedAccounts = accounts?.map(acc => ({
        ...acc,
        data_source: acc.data_source as 'crm' | 'database' | 'both',
        score: scoresMap.get(acc.external_id),
        contacts_count: contactCountsMap.get(acc.external_id) || 0
      })) || [];

      setMatchedAccounts(enrichedAccounts);
      setMatchedCount(enrichedAccounts.length);
    } catch (error) {
      console.error('Error applying filters:', error);
      toast({
        title: "Error",
        description: "Failed to apply filters",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (matchedAccounts.length === 0) {
      toast({
        title: "No accounts to export",
        description: "Apply filters to generate your campaign list",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      'Account Name',
      'Domain',
      'Industry',
      'Employee Count',
      'Country',
      'ICP Score',
      'Contacts Available',
      'Data Source'
    ];

    const rows = matchedAccounts.map(acc => [
      acc.name || '',
      acc.domain || '',
      acc.industry_norm || '',
      acc.employee_count || '',
      acc.country || '',
      acc.score || '',
      acc.contacts_count || 0,
      getSourceLabel(acc.data_source)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-list-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "✓ List Exported",
      description: `${matchedAccounts.length.toLocaleString()} accounts exported to CSV`
    });
  };

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      const current = prev[category] as string[];
      if (current.includes(value)) {
        return { ...prev, [category]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [category]: [...current, value] };
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Campaign Builder
        </h1>
        <p className="text-muted-foreground mt-2">
          Build targeted account lists for campaigns using ICP criteria and persona filters
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Filters Sidebar */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CardDescription>Refine your target audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ICP Score Filter */}
              <div>
                <Label>ICP Fit Score</Label>
                <Select value={filters.icpScore} onValueChange={(value) => setFilters(prev => ({ ...prev, icpScore: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="high">High-Fit (70+)</SelectItem>
                    <SelectItem value="medium">Medium-Fit (40-69)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Industries */}
              <div>
                <Label className="mb-3 block">Industries</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableFilters.industries.slice(0, 10).map(industry => (
                    <div key={industry} className="flex items-center gap-2">
                      <Checkbox
                        id={`industry-${industry}`}
                        checked={filters.industries.includes(industry)}
                        onCheckedChange={() => toggleFilter('industries', industry)}
                      />
                      <label htmlFor={`industry-${industry}`} className="text-sm cursor-pointer">
                        {industry}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Geographies */}
              <div>
                <Label className="mb-3 block">Countries</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableFilters.geographies.slice(0, 10).map(country => (
                    <div key={country} className="flex items-center gap-2">
                      <Checkbox
                        id={`country-${country}`}
                        checked={filters.geographies.includes(country)}
                        onCheckedChange={() => toggleFilter('geographies', country)}
                      />
                      <label htmlFor={`country-${country}`} className="text-sm cursor-pointer">
                        {country}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Data Source */}
              <div>
                <Label>Data Source</Label>
                <Select value={filters.dataSource} onValueChange={(value) => setFilters(prev => ({ ...prev, dataSource: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="crm">CRM Only</SelectItem>
                    <SelectItem value="database">Database Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="col-span-9 space-y-4">
          {/* Summary Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campaign-Ready Accounts</p>
                    <p className="text-3xl font-bold text-primary">
                      {loading ? '...' : matchedCount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={exportToCSV} disabled={matchedAccounts.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export to CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accounts List */}
          <Card>
            <CardHeader>
              <CardTitle>Matched Accounts</CardTitle>
              <CardDescription>
                {matchedCount > 0 ? `${matchedCount.toLocaleString()} accounts match your criteria` : 'No accounts match your filters'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : matchedAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No accounts match your filters</p>
                  <p className="text-sm text-muted-foreground mt-2">Try adjusting your filter criteria</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchedAccounts.slice(0, 50).map(account => (
                    <div key={account.external_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-semibold">{account.name}</p>
                          <Badge variant={getSourceBadgeVariant(account.data_source)}>
                            {getSourceLabel(account.data_source)}
                          </Badge>
                          {account.score && account.score >= 70 && (
                            <Badge className="bg-green-500">
                              <Sparkles className="h-3 w-3 mr-1" />
                              High-Fit
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{account.industry_norm}</span>
                          <span>•</span>
                          <span>{account.country}</span>
                          {account.employee_count && (
                            <>
                              <span>•</span>
                              <span>{account.employee_count.toLocaleString()} employees</span>
                            </>
                          )}
                          {account.contacts_count > 0 && (
                            <>
                              <span>•</span>
                              <span>{account.contacts_count} contacts</span>
                            </>
                          )}
                        </div>
                      </div>
                      {account.score && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{account.score}</p>
                          <p className="text-xs text-muted-foreground">ICP Score</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {matchedAccounts.length > 50 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Showing first 50 of {matchedAccounts.length.toLocaleString()} accounts. Export to see all.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
