import { AlertCircle, TrendingUp, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/utils/format-numbers";
import { getSourceLabel, getSourceBadgeVariant } from "@/utils/data-source-attribution";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";

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
    reasons?: Array<{
      factor: string;
      match: boolean;
      score: number;
      value: string | number;
      icp_range?: { min: number; max: number };
    }>;
  } | null;
  leads?: number;
  campaignReadyLeads?: number;
}

interface AccountsTableProps {
  accounts: Account[];
  totalCount: number;
  selectedAccountIds: Set<string>;
  setSelectedAccountIds: (ids: Set<string>) => void;
  onAccountClick: (account: Account) => void;
  onScoreClick: (account: Account) => void;
  hasActiveFilters: boolean;
  fitFilter: string | null;
  clearFilters: () => void;
  // Infinite scroll props
  observerTarget: React.RefObject<HTMLDivElement>;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
  lastError: Error | null;
}

function calculateDataCompleteness(account: Account): number {
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
}

export function AccountsTable({
  accounts,
  totalCount,
  selectedAccountIds,
  setSelectedAccountIds,
  onAccountClick,
  onScoreClick,
  hasActiveFilters,
  fitFilter,
  clearFilters,
  observerTarget,
  isLoadingMore,
  hasMore,
  loadMore,
  retry,
  lastError,
}: AccountsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Accounts ({formatNumber(totalCount)})</CardTitle>
        <CardDescription>
          Click on any row to view detailed account information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedAccountIds.size > 0 && selectedAccountIds.size === accounts.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAccountIds(new Set(accounts.map(a => a.external_id)));
                    } else {
                      setSelectedAccountIds(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Enriched</TableHead>
              <TableHead>Data Quality</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Campaign Ready</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
                    <div>
                      <h3 className="font-semibold text-lg">
                        {fitFilter 
                          ? `No ${fitFilter.charAt(0).toUpperCase() + fitFilter.slice(1)}-Fit accounts found`
                          : hasActiveFilters 
                          ? "No accounts match your filters"
                          : "No accounts found"
                        }
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {fitFilter ? (
                          <>Try scoring more accounts or adjust your ICP criteria</>
                        ) : hasActiveFilters ? (
                          <>Try adjusting your filters to see more results</>
                        ) : (
                          <>Upload your CRM data to get started</>
                        )}
                      </p>
                    </div>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-2" />
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => {
                const completeness = calculateDataCompleteness(account);
                const isSelected = selectedAccountIds.has(account.external_id);
                
                return (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedAccountIds);
                          if (checked) {
                            newSelected.add(account.external_id);
                          } else {
                            newSelected.delete(account.external_id);
                          }
                          setSelectedAccountIds(newSelected);
                        }}
                      />
                    </TableCell>
                    <TableCell onClick={() => onAccountClick(account)}>
                      <div>
                        <div className="font-medium">{account.name || 'Unknown Company'}</div>
                        <div className="text-sm text-muted-foreground">{account.domain}</div>
                      </div>
                    </TableCell>
                    <TableCell>{account.industry_norm || account.industry_raw || '-'}</TableCell>
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
                    <TableCell>
                      <span className="text-sm">
                        {account.leads || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {account.campaignReadyLeads !== undefined && account.campaignReadyLeads > 0 ? (
                          <>
                            <Badge variant="default" className="w-fit">
                              {account.campaignReadyLeads}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              of {account.leads || 0}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
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
                              onScoreClick(account);
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
                                onScoreClick(account);
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
              })
            )}
          </TableBody>
        </Table>

        <InfiniteScrollTrigger
          observerTarget={observerTarget}
          isLoading={isLoadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRetry={retry}
          error={lastError}
          itemsCount={accounts.length}
          totalCount={totalCount}
        />
      </CardContent>
    </Card>
  );
}
