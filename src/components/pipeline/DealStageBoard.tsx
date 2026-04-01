import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, DollarSign } from 'lucide-react';
import { useOpportunities, DEAL_STAGES, type Deal } from '@/hooks/use-opportunities';
import { DealDetailDialog } from './DealDetailDialog';
import { CreateDealDialog } from './CreateDealDialog';
import { Skeleton } from '@/components/ui/skeleton';

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function DealStageBoard() {
  const { data: deals = [], isLoading } = useOpportunities();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const openStages = DEAL_STAGES.filter(s => s.key !== 'closed_won' && s.key !== 'closed_lost');

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-32" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Deal Pipeline</h2>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Deal
          </Button>
        </div>
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="py-10 text-center space-y-3">
            <DollarSign className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold text-lg">No deals yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Create your first deal to start tracking pipeline stages and revenue attribution.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create First Deal
            </Button>
          </CardContent>
        </Card>
        <CreateDealDialog open={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Deal Pipeline</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Deal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {openStages.map((stage) => {
          const stageDeals = deals.filter(d => d.stage === stage.key);
          const totalValue = stageDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

          return (
            <Card key={stage.key} className="min-h-[200px]">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                    {stage.label}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {stageDeals.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(totalValue)}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2 max-h-[400px] overflow-auto">
                {stageDeals.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                ) : (
                  stageDeals.map((deal) => (
                    <button
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      className="w-full text-left p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors space-y-1"
                    >
                      <p className="text-sm font-medium truncate">{deal.name}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{deal.amount ? formatCurrency(deal.amount) : '—'}</span>
                        {deal.owner_name && <span>{deal.owner_name}</span>}
                      </div>
                      {deal.attribution_utm && (deal.attribution_utm as Record<string, string>)?.utm_campaign && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          {(deal.attribution_utm as Record<string, string>).utm_campaign}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Closed deals summary */}
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        {(['closed_won', 'closed_lost'] as const).map(stageKey => {
          const stageConfig = DEAL_STAGES.find(s => s.key === stageKey)!;
          const stageDeals = deals.filter(d => d.stage === stageKey);
          const totalValue = stageDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

          return (
            <Card key={stageKey}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${stageConfig.color}`} />
                    {stageConfig.label}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                    <span className="text-sm font-medium">{formatCurrency(totalValue)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="max-h-[200px] overflow-auto space-y-1">
                {stageDeals.slice(0, 5).map(deal => (
                  <button
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="w-full text-left p-2 rounded text-xs hover:bg-muted/50 flex justify-between items-center"
                  >
                    <span className="truncate">{deal.name}</span>
                    <span className="text-muted-foreground ml-2">{deal.amount ? formatCurrency(deal.amount) : '—'}</span>
                  </button>
                ))}
                {stageDeals.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{stageDeals.length - 5} more</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DealDetailDialog deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      <CreateDealDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
}
