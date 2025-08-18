import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatusIndicatorProps {
  value: number;
  threshold: { low: number; medium: number; high: number };
  size?: "sm" | "md" | "lg";
  showTrend?: boolean;
  trend?: number;
  className?: string;
}

export function StatusIndicator({
  value,
  threshold,
  size = "md",
  showTrend = false,
  trend,
  className
}: StatusIndicatorProps) {
  const getStatusColor = () => {
    if (value >= threshold.high) return "bg-[hsl(var(--executive-green))]";
    if (value >= threshold.medium) return "bg-[hsl(var(--executive-amber))]";
    return "bg-[hsl(var(--executive-red))]";
  };

  const getStatusText = () => {
    if (value >= threshold.high) return "EXCELLENT";
    if (value >= threshold.medium) return "GOOD";
    return "NEEDS ATTENTION";
  };

  const getTrendIcon = () => {
    if (!trend) return <Minus className="h-3 w-3" />;
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-[hsl(var(--executive-green))]" />;
    return <TrendingDown className="h-3 w-3 text-[hsl(var(--executive-red))]" />;
  };

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4"
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-full",
          sizeClasses[size],
          getStatusColor()
        )}
      />
      
      {size !== "sm" && (
        <span className="text-xs font-medium text-muted-foreground">
          {getStatusText()}
        </span>
      )}
      
      {showTrend && trend !== undefined && (
        <div className="flex items-center gap-1">
          {getTrendIcon()}
          <span className={cn(
            "text-xs font-medium",
            trend > 0 ? "text-[hsl(var(--executive-green))]" : "text-[hsl(var(--executive-red))]"
          )}>
            {trend > 0 ? "+" : ""}{Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );
}