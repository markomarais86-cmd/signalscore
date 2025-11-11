import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScoreBandBadgeProps {
  band: 'A' | 'B' | 'C';
  score: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBandBadge({ band, score, showScore = true, size = 'md' }: ScoreBandBadgeProps) {
  const getBandConfig = (band: 'A' | 'B' | 'C') => {
    switch (band) {
      case 'A':
        return {
          label: 'High Fit',
          description: 'Score ≥70 - Excellent match for your ICP',
          className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
        };
      case 'B':
        return {
          label: 'Medium Fit',
          description: 'Score 40-69 - Moderate match for your ICP',
          className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20'
        };
      case 'C':
        return {
          label: 'Low Fit',
          description: 'Score <40 - Poor match for your ICP',
          className: 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
        };
    }
  };

  const config = getBandConfig(band);
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${config.className} ${sizeClasses[size]} font-semibold cursor-help`}
          >
            {showScore ? `${band} (${score})` : band}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
