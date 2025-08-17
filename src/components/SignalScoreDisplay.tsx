import { cn } from "@/lib/utils";

interface SignalScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  trend?: number;
  className?: string;
}

export function SignalScoreDisplay({
  score,
  size = "md",
  showLabel = true,
  trend,
  className
}: SignalScoreDisplayProps) {
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
      
      {showLabel && (
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