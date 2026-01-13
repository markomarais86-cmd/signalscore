import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HistoricalJob {
  id: string;
  provider: string;
  status: string;
  enriched_records: number;
  failed_records: number;
  total_records: number;
  completed_at: string | null;
  started_at: string | null;
  source_breakdown: Record<string, { attempted: number; enriched: number; failed: number }> | null;
}

interface EnrichmentHistoryProps {
  jobs: HistoricalJob[];
}

const providerLabels: Record<string, string> = {
  apollo: 'Apollo',
  pdl: 'PDL',
  ai_free: 'AI Free',
  smart_enrich: 'Smart',
  clearbit: 'Clearbit',
};

export function EnrichmentHistory({ jobs }: EnrichmentHistoryProps) {
  const calculateDuration = (job: HistoricalJob) => {
    if (!job.started_at || !job.completed_at) return '-';
    
    const start = new Date(job.started_at).getTime();
    const end = new Date(job.completed_at).getTime();
    const durationMs = end - start;
    
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
    return `${(durationMs / 3600000).toFixed(1)}h`;
  };

  const getSuccessRate = (job: HistoricalJob) => {
    if (job.total_records === 0) return 0;
    return Math.round((job.enriched_records / job.total_records) * 100);
  };

  const getStatusIcon = (status: string, successRate: number) => {
    if (status === 'failed') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (status === 'completed_with_errors' || successRate < 80) {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  };

  if (jobs.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Recent History</h3>
        <div className="p-8 text-center border rounded-lg bg-muted/30">
          <p className="text-muted-foreground">No completed enrichment jobs yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Recent History</h3>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enriched</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const successRate = getSuccessRate(job);
                
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {providerLabels[job.provider] || job.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status, successRate)}
                        <span className="text-sm capitalize">
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {job.enriched_records.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {job.failed_records.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant="secondary"
                        className={
                          successRate >= 80 ? 'bg-green-100 text-green-700' :
                          successRate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }
                      >
                        {successRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {calculateDuration(job)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {job.completed_at 
                        ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
