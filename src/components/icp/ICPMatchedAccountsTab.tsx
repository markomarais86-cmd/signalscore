import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, Users, TrendingUp, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'react-router-dom';

interface MatchedAccount {
  account_external_id: string;
  overall: number;
  fit: number;
  intent: number;
  account_name: string | null;
  industry: string | null;
  employee_count: number | null;
  country: string | null;
}

interface ScoreDistribution {
  highFit: number;
  mediumFit: number;
  lowFit: number;
  total: number;
}

interface ICPMatchedAccountsTabProps {
  icpId: string;
  icpName: string;
}

export function ICPMatchedAccountsTab({ icpId, icpName }: ICPMatchedAccountsTabProps) {
  const { userProfile: profile } = useAuth();
  const [accounts, setAccounts] = useState<MatchedAccount[]>([]);
  const [distribution, setDistribution] = useState<ScoreDistribution>({ highFit: 0, mediumFit: 0, lowFit: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (profile?.org_id && icpId) {
      loadMatchedAccounts();
    }
  }, [profile?.org_id, icpId, page]);

  async function loadMatchedAccounts() {
    if (!profile?.org_id) return;
    setLoading(true);

    try {
      // Get distribution counts
      const { data: distData } = await supabase
        .from('scores')
        .select('overall')
        .eq('org_id', profile.org_id)
        .eq('icp_id', icpId);

      if (distData) {
        const { HIGH_FIT_THRESHOLD, MEDIUM_FIT_THRESHOLD } = await import('@/lib/score-bands');
        const dist = {
          highFit: distData.filter(s => s.overall >= HIGH_FIT_THRESHOLD).length,
          mediumFit: distData.filter(s => s.overall >= MEDIUM_FIT_THRESHOLD && s.overall < HIGH_FIT_THRESHOLD).length,
          lowFit: distData.filter(s => s.overall < MEDIUM_FIT_THRESHOLD).length,
          total: distData.length
        };
        setDistribution(dist);
      }

      // Get paginated accounts with scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('account_external_id, overall, fit, intent')
        .eq('org_id', profile.org_id)
        .eq('icp_id', icpId)
        .order('overall', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (scoresError) throw scoresError;

      if (scoresData && scoresData.length > 0) {
        // Get account details
        const externalIds = scoresData.map(s => s.account_external_id);
        const { data: accountsData } = await supabase
          .from('accounts')
          .select('external_id, name, industry_norm, employee_count, country')
          .eq('org_id', profile.org_id)
          .in('external_id', externalIds);

        const accountMap = new Map(accountsData?.map(a => [a.external_id, a]) || []);
        
        const merged = scoresData.map(score => {
          const account = accountMap.get(score.account_external_id);
          return {
            ...score,
            account_name: account?.name || null,
            industry: account?.industry_norm || null,
            employee_count: account?.employee_count || null,
            country: account?.country || null
          };
        });

        setAccounts(merged);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('Error loading matched accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  const getFitBadge = (score: number) => {
    if (score >= 60) return <Badge className="bg-[hsl(var(--signal-high))]/10 text-[hsl(var(--signal-high))] border-[hsl(var(--signal-high))]/20">High Fit</Badge>;
    if (score >= 40) return <Badge className="bg-[hsl(var(--signal-medium))]/10 text-[hsl(var(--signal-medium))] border-[hsl(var(--signal-medium))]/20">Medium Fit</Badge>;
    return <Badge className="bg-[hsl(var(--signal-low))]/10 text-[hsl(var(--signal-low))] border-[hsl(var(--signal-low))]/20">Low Fit</Badge>;
  };

  if (loading && accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (distribution.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matched Accounts</CardTitle>
          <CardDescription>Accounts scored against {icpName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Building className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No accounts scored yet</p>
            <p className="text-sm">Run bulk scoring to see matched accounts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(distribution.total / pageSize);

  return (
    <div className="space-y-6">
      {/* Score Distribution Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Score Distribution
          </CardTitle>
          <CardDescription>
            {distribution.total.toLocaleString()} accounts scored against {icpName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[hsl(var(--signal-high))]">High Fit (70+)</span>
                <span className="text-sm font-bold">{distribution.highFit.toLocaleString()}</span>
              </div>
              <Progress 
                value={(distribution.highFit / distribution.total) * 100} 
                className="h-2 [&>div]:bg-[hsl(var(--signal-high))]" 
              />
              <span className="text-xs text-muted-foreground">
                {((distribution.highFit / distribution.total) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[hsl(var(--signal-medium))]">Medium Fit (40-69)</span>
                <span className="text-sm font-bold">{distribution.mediumFit.toLocaleString()}</span>
              </div>
              <Progress 
                value={(distribution.mediumFit / distribution.total) * 100} 
                className="h-2 [&>div]:bg-[hsl(var(--signal-medium))]" 
              />
              <span className="text-xs text-muted-foreground">
                {((distribution.mediumFit / distribution.total) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[hsl(var(--signal-low))]">Low Fit (&lt;40)</span>
                <span className="text-sm font-bold">{distribution.lowFit.toLocaleString()}</span>
              </div>
              <Progress 
                value={(distribution.lowFit / distribution.total) * 100} 
                className="h-2 [&>div]:bg-[hsl(var(--signal-low))]" 
              />
              <span className="text-xs text-muted-foreground">
                {((distribution.lowFit / distribution.total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Matched Accounts
          </CardTitle>
          <CardDescription>
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, distribution.total)} of {distribution.total.toLocaleString()} accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Fit Level</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.account_external_id}>
                  <TableCell className="font-medium">
                    {account.account_name || account.account_external_id}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.industry || '—'}
                  </TableCell>
                  <TableCell>
                    {account.employee_count ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {account.employee_count.toLocaleString()}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.country || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {account.overall}
                  </TableCell>
                  <TableCell className="text-right">
                    {getFitBadge(account.overall)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/accounts/${account.account_external_id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
