import { cn } from "@/lib/utils";
import { getScoreBand } from "@/lib/score-bands";

interface SignalScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  trend?: number;
  className?: string;
  showBand?: boolean;
  band?: 'A' | 'B' | 'C';
}

export function SignalScoreDisplay({
  score,
  size = "md",
  showLabel = true,
  trend,
  className,
  showBand = false,
  band
}: SignalScoreDisplayProps) {
  // Auto-calculate band if not provided
  const scoreBand = band || getScoreBand(score);
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-[hsl(var(--signal-high))]";
    if (score >= 50) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-[hsl(var(--signal-high))]";
    if (score >= 50) return "bg-[hsl(var(--signal-medium))]";
    return "bg-[hsl(var(--signal-low))]";
  };

  const getScoreStatus = (score: number) => {
    if (score >= 80) return "HIGH";
    if (score >= 50) return "MEDIUM";
    return "LOW";
  };

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl"
  };

  const badgeSizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2",
    xl: "text-lg px-6 py-3"
  };

  const getBandClass = (band: 'A' | 'B' | 'C') => {
    if (band === 'A') return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    if (band === 'B') return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div className={cn("font-bold", sizeClasses[size], getScoreColor(score))}>
          {score}
        </div>
        {trend !== undefined && (
          <div className={cn(
            "text-xs font-medium mt-1",
            trend > 0 ? "text-[hsl(var(--signal-high))]" : "text-[hsl(var(--signal-low))]"
          )}>
            {trend > 0 ? "+" : ""}{trend}
          </div>
        )}
      </div>
      
      {showBand && (
        <div className={cn(
          "rounded-md border font-semibold px-2 py-1",
          badgeSizeClasses[size],
          getBandClass(scoreBand)
        )}>
          {scoreBand}
        </div>
      )}
      
      {showLabel && !showBand && (
        <div className="flex flex-col">
          <div className={cn(
            "rounded-full font-medium text-white",
            badgeSizeClasses[size],
            getScoreBg(score)
          )}>
            {getScoreStatus(score)}
          </div>
          {size !== "sm" && (
            <div className="text-xs text-muted-foreground mt-1">
              SignalScore
            </div>
          )}
        </div>
      )}
    </div>
  );
}