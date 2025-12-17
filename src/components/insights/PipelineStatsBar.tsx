import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Calendar } from "lucide-react";

interface PipelineStats {
  qualified: number;
  follow_up: number;
  meeting_ready: number;
}

interface PipelineStatsBarProps {
  stats: PipelineStats;
}

export function PipelineStatsBar({ stats }: PipelineStatsBarProps) {
  return (
    <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/50 text-xs">
      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        <span className="text-muted-foreground">Qualified:</span>
        <Badge variant="secondary" className="h-5 text-xs">{stats.qualified}</Badge>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3 text-amber-500" />
        <span className="text-muted-foreground">Follow-up:</span>
        <Badge variant="secondary" className="h-5 text-xs">{stats.follow_up}</Badge>
      </div>
      <div className="flex items-center gap-1">
        <Calendar className="h-3 w-3 text-primary" />
        <span className="text-muted-foreground">Meeting Ready:</span>
        <Badge variant="secondary" className="h-5 text-xs">{stats.meeting_ready}</Badge>
      </div>
    </div>
  );
}
