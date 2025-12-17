import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, Play, X } from "lucide-react";
import { TIMING } from "@/lib/constants";

export interface EnrichmentProgress {
  jobId: string;
  status: string;
  processed: number;
  total: number;
  enriched: number;
  lastProgressUpdate?: string;
  isStalled?: boolean;
}

interface EnrichmentProgressBannerProps {
  progress: EnrichmentProgress;
  isStarting: boolean;
  onResume: () => void;
  onCancel: () => void;
}

export function EnrichmentProgressBanner({ 
  progress, 
  isStarting, 
  onResume, 
  onCancel 
}: EnrichmentProgressBannerProps) {
  const progressPercent = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;
  
  const isPaused = progress.status === 'paused';
  const isProcessing = progress.status === 'processing' || progress.status === 'pending';
  
  // Check if job is stalled
  const lastUpdate = progress.lastProgressUpdate ? new Date(progress.lastProgressUpdate) : null;
  const isStalled = progress.status === 'processing' && lastUpdate && 
    (new Date().getTime() - lastUpdate.getTime() > TIMING.JOB_STALL_THRESHOLD);

  return (
    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isStalled || isPaused ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="font-medium text-sm">
            {isPaused ? 'Enrichment Paused' : isStalled ? 'Enrichment Stalled' : 'AI Enrichment in Progress'}
          </span>
          <Badge variant="outline" className="text-xs">
            {progress.enriched} enriched
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {(isStalled || isPaused) && (
            <Button 
              size="sm" 
              variant="outline" 
              className="h-6 text-xs"
              onClick={onResume}
              disabled={isStarting}
            >
              {isStarting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </>
              )}
            </Button>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={onCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress.processed} / {progress.total} processed</span>
          <span>{progressPercent}%</span>
        </div>
      </div>
    </div>
  );
}
