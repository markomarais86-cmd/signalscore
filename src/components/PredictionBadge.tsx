import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

interface PredictionBadgeProps {
  probability: number | null | undefined;
  confidence?: number;
  factors?: PredictionFactor[];
  isLoading?: boolean;
  error?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function PredictionBadge({
  probability,
  confidence,
  factors,
  isLoading,
  error,
  size = 'md',
  showLabel = true,
  className,
}: PredictionBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {showLabel && <span>Calculating...</span>}
      </Badge>
    );
  }

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)}>
              <AlertCircle className="h-3 w-3" />
              {showLabel && <span>N/A</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (probability === null || probability === undefined) {
    return (
      <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        {showLabel && <span>No prediction</span>}
      </Badge>
    );
  }

  const percentage = Math.round(probability * 100);
  
  const getVariant = (prob: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (prob >= 0.7) return 'default';
    if (prob >= 0.4) return 'secondary';
    return 'destructive';
  };

  const getColorClass = (prob: number): string => {
    if (prob >= 0.7) return 'bg-[hsl(var(--signal-high))] hover:bg-[hsl(var(--signal-high))]/90';
    if (prob >= 0.4) return 'bg-[hsl(var(--signal-medium))] hover:bg-[hsl(var(--signal-medium))]/90';
    return 'bg-[hsl(var(--signal-low))] hover:bg-[hsl(var(--signal-low))]/90';
  };

  const getIcon = (prob: number) => {
    const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';
    if (prob >= 0.7) return <TrendingUp className={iconSize} />;
    if (prob >= 0.4) return <Minus className={iconSize} />;
    return <TrendingDown className={iconSize} />;
  };

  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';

  const badgeContent = (
    <Badge 
      className={cn(
        "gap-1 text-white border-0",
        getColorClass(probability),
        sizeClass,
        className
      )}
    >
      {getIcon(probability)}
      <span className="font-semibold">{percentage}%</span>
      {showLabel && size !== 'sm' && (
        <span className="opacity-90">convert</span>
      )}
    </Badge>
  );

  if (factors && factors.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">Conversion Probability</span>
                <span className="font-bold">{percentage}%</span>
              </div>
              {confidence !== undefined && (
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Confidence</span>
                  <span>{Math.round(confidence * 100)}%</span>
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-medium">Key Factors:</span>
                {factors.slice(0, 4).map((factor, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      {factor.impact === 'positive' && <TrendingUp className="h-3 w-3 text-[hsl(var(--signal-high))]" />}
                      {factor.impact === 'negative' && <TrendingDown className="h-3 w-3 text-[hsl(var(--signal-low))]" />}
                      {factor.impact === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
                      {factor.name}
                    </span>
                    <span className={cn(
                      "font-medium",
                      factor.impact === 'positive' && "text-[hsl(var(--signal-high))]",
                      factor.impact === 'negative' && "text-[hsl(var(--signal-low))]"
                    )}>
                      {factor.impact === 'positive' ? '+' : factor.impact === 'negative' ? '-' : ''}{Math.round(factor.weight * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

// Compact version for table cells
export function PredictionBadgeCompact({
  probability,
  isLoading,
  className,
}: {
  probability: number | null | undefined;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <PredictionBadge
      probability={probability}
      isLoading={isLoading}
      size="sm"
      showLabel={false}
      className={className}
    />
  );
}

export default PredictionBadge;
