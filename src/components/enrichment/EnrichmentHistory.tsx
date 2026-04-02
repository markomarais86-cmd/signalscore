import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HistoricalJob {
  id: string;
  provider: string;
  status: string;
  enriched_records: number;
  failed_records: number;
  total_records: number;
  processed_records: number;
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
  ai_free: 'AI Research',
  smart_enrich: 'Smart',
  launch_pulse: 'AI Research',
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

  const getAlreadyComplete = (job: HistoricalJob) => {
    const processed = job.processed_records || 0;
    const enriched = job.enriched_records || 0;
    const failed = job.failed_records || 0;
    return Math.max(0, processed - enriched - failed);
  };

  const getStatusIcon = (job: HistoricalJob) => {
    if (job.status === 'failed') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    const alreadyComplete = getAlreadyComplete(job);
    // If most records were already complete, show a different icon
    if (job.enriched_records === 0 && alreadyComplete > 0) {
      return <Zap className="h-4 w-4 text-blue-600" />;
    }
    if (job.status === 'completed_with_errors' || job.failed_records > 0) {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  };

  const getStatusLabel = (job: HistoricalJob) => {
    if (job.status === 'failed') return 'Failed';
    const alreadyComplete = getAlreadyComplete(job);
    if (job.enriched_records === 0 && alreadyComplete > 0) {
      return 'Up to date';
    }
    if (job.status === 'completed_with_errors') return 'Partial';
    return job.status.replace('_', ' ');
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
      
      {/* Mobile cards */}
      <div className="block sm:hidden space-y-3">
        {jobs.map((job) => {
          const alreadyComplete = getAlreadyComplete(job);
          return (
            <Card key={job.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-normal">
                    {providerLabels[job.provider] || job.provider}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-sm">
                    {getStatusIcon(job)}
                    <span className="capitalize">{getStatusLabel(job)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">New Data</span>
                    <div className={job.enriched_records > 0 ? "font-medium text-green-600" : "text-muted-foreground"}>
                      {job.enriched_records.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Already OK</span>
                    <div className={alreadyComplete > 0 ? "text-blue-600" : "text-muted-foreground"}>
                      {alreadyComplete.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Not Found</span>
                    <div className="text-muted-foreground">{job.failed_records.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{calculateDuration(job)}</div>
                  <span>{job.completed_at ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true }) : '-'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">New Data</TableHead>
                <TableHead className="text-right">Already OK</TableHead>
                <TableHead className="text-right">Not Found</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const alreadyComplete = getAlreadyComplete(job);
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {providerLabels[job.provider] || job.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job)}
                        <span className="text-sm capitalize">{getStatusLabel(job)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {job.enriched_records > 0 ? (
                        <span className="font-medium text-green-600">{job.enriched_records.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {alreadyComplete > 0 ? (
                        <span className="text-blue-600">{alreadyComplete.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.failed_records > 0 ? (
                        <span className="text-muted-foreground">{job.failed_records.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
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
