import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { DealAtRisk } from '@/hooks/use-pipeline-analytics';

interface DealsAtRiskTableProps {
  deals: DealAtRisk[];
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closing: 'Closing',
};

export function DealsAtRiskTable({ deals }: DealsAtRiskTableProps) {
  if (!deals || deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2 text-green-500" />
        <p className="text-sm">No deals at risk!</p>
        <p className="text-xs">All deals are progressing normally</p>
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell className="font-medium">
                <div className="max-w-[150px] truncate" title={deal.name}>
                  {deal.name}
                </div>
              </TableCell>
              <TableCell>{formatCurrency(deal.amount)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {STAGE_LABELS[deal.stage] || deal.stage}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {deal.daysOverdue > 0 && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{deal.daysOverdue}d overdue</span>
                    </div>
                  )}
                  {deal.daysInStage > 14 && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Clock className="h-3 w-3" />
                      <span>{deal.daysInStage}d in stage</span>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
