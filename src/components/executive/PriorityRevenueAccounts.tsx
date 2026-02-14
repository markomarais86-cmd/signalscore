import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Crown, Users, Search, ArrowUpDown, ChevronRight, Sparkles, Mail, Phone, FileText, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { supabase } from '@/integrations/supabase/client';

interface PriorityRevenueAccountsProps {
  icpId?: string;
  limit?: number;
}

interface DealInfo {
  status: string;
  stage: string;
  amount: number | null;
  updatedAt: string;
}

interface PriorityAccount {
  accountExternalId: string;
  name: string;
  industry: string | null;
  fit: number;
  intent: number;
  reachability: number;
  readiness: number;
  contactCount: number;
  deal: DealInfo | null;
  enrichedAt: string | null;
  nextAction: { label: string; icon: React.ElementType };
}

const EARLY_STAGES = ['discovery', 'qualification', 'prospecting', 'lead', 'mql', 'sql'];
const LATE_STAGES = ['proposal', 'negotiation', 'contract', 'closing', 'commit'];

function computeReadiness(
  fit: number | null,
  intent: number | null,
  reachability: number | null,
  hasContacts: boolean,
  hasDeal: boolean
): number {
  return Math.round(
    (fit ?? 0) * 0.3 +
    (intent ?? 0) * 0.3 +
    (reachability ?? 0) * 0.2 +
    (hasContacts ? 10 : 0) +
    (hasDeal ? 10 : 0)
  );
}

function getNextAction(
  account: {
    contactCount: number;
    deal: DealInfo | null;
    fit: number;
    intent: number;
    enrichedAt: string | null;
  }
): { label: string; icon: React.ElementType } {
  // Priority order of rules
  if (!account.enrichedAt) {
    return { label: 'Enrich account data', icon: Search };
  }
  if (account.contactCount === 0) {
    return { label: 'Find decision-maker contacts', icon: Users };
  }
  if (!account.deal) {
    return { label: 'Create outbound sequence', icon: Mail };
  }
  // Deal exists — check stage/staleness
  const stageLower = account.deal.stage.toLowerCase();
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(account.deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceUpdate >= 30) {
    return { label: 'Re-engage — deal stalling', icon: AlertTriangle };
  }
  if (LATE_STAGES.some((s) => stageLower.includes(s))) {
    return { label: 'Send proposal / negotiate', icon: FileText };
  }
  if (EARLY_STAGES.some((s) => stageLower.includes(s))) {
    return { label: 'Schedule discovery call', icon: Phone };
  }
  // Fallback scoring rules
  if (account.fit >= 60 && account.intent < 30) {
    return { label: 'Nurture with content', icon: BookOpen };
  }
  return { label: 'Review account', icon: RefreshCw };
}

function readinessColor(score: number): string {
  if (score > 70) return 'hsl(142, 71%, 45%)';
  if (score >= 40) return 'hsl(38, 92%, 50%)';
  return 'hsl(0, 84%, 60%)';
}

type SortField = 'readiness' | 'fit' | 'intent' | 'contactCount';

export function PriorityRevenueAccounts({ icpId, limit = 25 }: PriorityRevenueAccountsProps) {
  const { effectiveOrgId } = useEffectiveOrg();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(limit);
  const [sortField, setSortField] = useState<SortField>('readiness');
  const [sortAsc, setSortAsc] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['priority-revenue-accounts', effectiveOrgId, icpId],
    enabled: !!effectiveOrgId,
    queryFn: async () => {
      let scoresQuery = supabase
        .from('scores')
        .select('fit, intent, reachability, overall, account_external_id, accounts!inner(name, industry_norm, enriched_at)')
        .eq('org_id', effectiveOrgId!)
        .not('fit', 'is', null);

      if (icpId) {
        scoresQuery = scoresQuery.eq('icp_id', icpId);
      }

      const [scoresRes, dealsRes, leadsRes] = await Promise.all([
        scoresQuery,
        supabase
          .from('deals')
          .select('account_external_id, status, stage, amount, updated_at')
          .eq('org_id', effectiveOrgId!),
        supabase
          .from('Leads')
          .select('account_external_id')
          .eq('org_id', effectiveOrgId!),
      ]);

      if (scoresRes.error) throw scoresRes.error;

      // Build deal lookup (keep most recent per account)
      const dealMap = new Map<string, DealInfo>();
      if (!dealsRes.error && dealsRes.data) {
        for (const d of dealsRes.data) {
          if (!d.account_external_id) continue;
          const existing = dealMap.get(d.account_external_id);
          if (!existing || new Date(d.updated_at) > new Date(existing.updatedAt)) {
            dealMap.set(d.account_external_id, {
              status: d.status,
              stage: d.stage,
              amount: d.amount,
              updatedAt: d.updated_at,
            });
          }
        }
      }

      // Build lead count lookup
      const leadCounts = new Map<string, number>();
      if (!leadsRes.error && leadsRes.data) {
        for (const l of leadsRes.data) {
          if (!l.account_external_id) continue;
          leadCounts.set(l.account_external_id, (leadCounts.get(l.account_external_id) ?? 0) + 1);
        }
      }

      return (scoresRes.data ?? [])
        .filter((r: any) => r.account_external_id)
        .map((row: any) => {
          const extId = row.account_external_id as string;
          const fit = (row.fit as number) ?? 0;
          const intent = (row.intent as number) ?? 0;
          const reachability = (row.reachability as number) ?? 0;
          const contactCount = leadCounts.get(extId) ?? 0;
          const deal = dealMap.get(extId) ?? null;
          const enrichedAt = row.accounts?.enriched_at ?? null;
          const readiness = computeReadiness(fit, intent, reachability, contactCount > 0, !!deal);

          const base = {
            accountExternalId: extId,
            name: row.accounts?.name ?? 'Unknown',
            industry: row.accounts?.industry_norm ?? null,
            fit,
            intent,
            reachability,
            readiness,
            contactCount,
            deal,
            enrichedAt,
          };

          return {
            ...base,
            nextAction: getNextAction(base),
          } satisfies PriorityAccount;
        });
    },
  });

  const sorted = useMemo(() => {
    if (!accounts) return [];
    const copy = [...accounts];
    copy.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [accounts, sortField, sortAsc]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-primary" />
            Priority Revenue Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Crown className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No scored accounts yet</p>
            <p className="text-xs mt-1">Score accounts to see priority rankings</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </span>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5 text-primary" />
          Priority Revenue Accounts
        </CardTitle>
        <CardDescription>
          Top {Math.min(visibleCount, sorted.length)} of {sorted.length} accounts ranked by readiness
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <SortableHeader field="readiness">Readiness</SortableHeader>
              <SortableHeader field="fit">Fit</SortableHeader>
              <SortableHeader field="intent">Intent</SortableHeader>
              <SortableHeader field="contactCount">Contacts</SortableHeader>
              <TableHead>Deal Stage</TableHead>
              <TableHead>Next Action</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((acc) => {
              const ActionIcon = acc.nextAction.icon;
              return (
                <TableRow
                  key={acc.accountExternalId}
                  className="cursor-pointer"
                  onClick={() => navigate(`/accounts/${acc.accountExternalId}`)}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{acc.name}</span>
                      {acc.industry && (
                        <Badge variant="secondary" className="text-[10px] w-fit px-1.5 py-0">
                          {acc.industry}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${acc.readiness}%`,
                            backgroundColor: readinessColor(acc.readiness),
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-7 text-right tabular-nums">
                        {acc.readiness}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{acc.fit}</TableCell>
                  <TableCell className="text-sm tabular-nums">{acc.intent}</TableCell>
                  <TableCell className="text-sm tabular-nums">{acc.contactCount}</TableCell>
                  <TableCell>
                    {acc.deal ? (
                      <Badge variant="outline" className="text-xs">
                        {acc.deal.stage}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{acc.nextAction.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => c + limit)}
            >
              Show more ({sorted.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
