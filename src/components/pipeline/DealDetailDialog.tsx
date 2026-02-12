import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  DEAL_STAGES, LOSS_CATEGORIES, useUpdateDealStage, useDealStageHistory,
  type Deal,
} from '@/hooks/use-opportunities';
import { ArrowRight, Clock, Tag } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

function formatCurrency(v: number) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface Props {
  deal: Deal | null;
  onClose: () => void;
}

export function DealDetailDialog({ deal, onClose }: Props) {
  const [newStage, setNewStage] = useState('');
  const [winReason, setWinReason] = useState('');
  const [lossCategory, setLossCategory] = useState('');
  const [lossReason, setLossReason] = useState('');
  const updateStage = useUpdateDealStage();
  const { data: history = [] } = useDealStageHistory(deal?.id ?? null);

  if (!deal) return null;

  const handleStageChange = () => {
    if (!newStage) return;
    updateStage.mutate({
      dealId: deal.id,
      stage: newStage,
      winReason: newStage === 'closed_won' ? winReason : undefined,
      lossCategory: newStage === 'closed_lost' ? lossCategory : undefined,
      lossReason: newStage === 'closed_lost' ? lossReason : undefined,
    }, {
      onSuccess: () => {
        setNewStage('');
        setWinReason('');
        setLossCategory('');
        setLossReason('');
        onClose();
      },
    });
  };

  const currentStage = DEAL_STAGES.find(s => s.key === deal.stage);
  const utmData = deal.attribution_utm as Record<string, string> | null;
  const clickIds = deal.attribution_click_ids as Record<string, string> | null;

  return (
    <Dialog open={!!deal} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{deal.name}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {currentStage && (
              <Badge className={`${currentStage.color} text-white border-0`}>
                {currentStage.label}
              </Badge>
            )}
            {deal.amount && <span className="font-medium">{formatCurrency(deal.amount)}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Stage Timeline */}
        {history.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Stage History
            </h4>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {history.map((h, i) => {
                const stageLabel = DEAL_STAGES.find(s => s.key === h.stage)?.label || h.stage;
                const duration = h.exited_at
                  ? differenceInDays(parseISO(h.exited_at), parseISO(h.entered_at))
                  : differenceInDays(new Date(), parseISO(h.entered_at));
                return (
                  <span key={h.id} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {stageLabel} ({duration}d)
                    </Badge>
                    {i < history.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        {/* Win/Loss info for closed deals */}
        {deal.stage === 'closed_won' && deal.win_reason && (
          <div className="text-sm">
            <span className="font-medium text-green-600">Win reason:</span> {deal.win_reason}
          </div>
        )}
        {deal.stage === 'closed_lost' && (
          <div className="text-sm space-y-1">
            {deal.loss_category && (
              <div><span className="font-medium text-destructive">Loss category:</span> {LOSS_CATEGORIES.find(c => c.key === deal.loss_category)?.label || deal.loss_category}</div>
            )}
            {deal.loss_reason && (
              <div><span className="font-medium text-destructive">Details:</span> {deal.loss_reason}</div>
            )}
          </div>
        )}

        {/* Attribution */}
        {(utmData?.utm_campaign || utmData?.utm_source || clickIds?.gclid || deal.attribution_funnel_variant) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Attribution
            </h4>
            <div className="flex flex-wrap gap-1">
              {utmData?.utm_source && <Badge variant="outline" className="text-[10px]">src: {utmData.utm_source}</Badge>}
              {utmData?.utm_medium && <Badge variant="outline" className="text-[10px]">med: {utmData.utm_medium}</Badge>}
              {utmData?.utm_campaign && <Badge variant="outline" className="text-[10px]">cmp: {utmData.utm_campaign}</Badge>}
              {clickIds?.gclid && <Badge variant="outline" className="text-[10px]">gclid ✓</Badge>}
              {clickIds?.fbclid && <Badge variant="outline" className="text-[10px]">fbclid ✓</Badge>}
              {clickIds?.li_fat_id && <Badge variant="outline" className="text-[10px]">li ✓</Badge>}
              {deal.attribution_funnel_variant && <Badge variant="outline" className="text-[10px]">var: {deal.attribution_funnel_variant}</Badge>}
            </div>
          </div>
        )}

        <Separator />

        {/* Move stage */}
        {deal.status === 'open' && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Move to Stage</h4>
            <Select value={newStage} onValueChange={setNewStage}>
              <SelectTrigger><SelectValue placeholder="Select stage..." /></SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.filter(s => s.key !== deal.stage).map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {newStage === 'closed_won' && (
              <div className="space-y-2">
                <Label>Why did we win?</Label>
                <Input value={winReason} onChange={e => setWinReason(e.target.value)} placeholder="e.g. Strong product fit, competitive pricing" />
              </div>
            )}

            {newStage === 'closed_lost' && (
              <div className="space-y-2">
                <Label>Loss Category</Label>
                <Select value={lossCategory} onValueChange={setLossCategory}>
                  <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                  <SelectContent>
                    {LOSS_CATEGORIES.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Details</Label>
                <Textarea value={lossReason} onChange={e => setLossReason(e.target.value)} placeholder="What happened?" rows={2} />
              </div>
            )}

            <Button onClick={handleStageChange} disabled={!newStage || updateStage.isPending} className="w-full">
              {updateStage.isPending ? 'Updating...' : `Move to ${DEAL_STAGES.find(s => s.key === newStage)?.label || '...'}`}
            </Button>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Owner: {deal.owner_name || '—'}</div>
          <div>Source: {deal.source || '—'}</div>
          <div>Expected Close: {deal.expected_close_date || '—'}</div>
          <div>Created: {formatDistanceToNow(parseISO(deal.created_at), { addSuffix: true })}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
