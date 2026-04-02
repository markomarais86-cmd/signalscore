import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { EnrichmentProgress } from "./types";

interface EnrichmentProgressBannerProps {
  progress: EnrichmentProgress;
  isStartingEnrichment: boolean;
  onResume: () => void;
}

export function EnrichmentProgressBanner({ progress, isStartingEnrichment, onResume }: EnrichmentProgressBannerProps) {
  const progressPercent = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className={`p-3 rounded-lg border ${
      progress.status === 'paused'
        ? 'bg-status-warning/5 border-status-warning/30'
        : progress.isStalled
        ? 'bg-destructive/5 border-destructive/30'
        : 'bg-primary/5 border-primary/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {progress.status === 'paused' ? (
            <AlertTriangle className="h-4 w-4 text-status-warning" />
          ) : progress.isStalled ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="font-medium text-sm">
            {progress.status === 'paused'
              ? 'Enrichment Paused'
              : progress.isStalled
              ? 'Enrichment Stalled'
              : 'AI Enrichment in Progress'}
          </span>
          {progress.status === 'paused' && (
            <Badge variant="outline" className="text-status-warning border-status-warning/50">
              {progress.total - progress.processed} remaining
            </Badge>
          )}
          {progress.isStalled && progress.status !== 'paused' && (
            <Badge variant="outline" className="text-destructive border-destructive/50">
              No progress for 5+ min
            </Badge>
          )}
        </div>
        <Badge variant="secondary">
          {progress.enriched} enriched
        </Badge>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>{progress.processed} / {progress.total} processed</span>
        <span>{progressPercent}%</span>
      </div>
      {(progress.status === 'paused' || progress.isStalled) && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={onResume}
            disabled={isStartingEnrichment}
            className="h-7 text-xs"
          >
            {isStartingEnrichment ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Resume Job
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {progress.status === 'paused'
              ? 'Click to continue processing'
              : 'Edge function may have timed out'}
          </span>
        </div>
      )}
    </div>
  );
}
