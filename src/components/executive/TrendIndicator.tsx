import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  value: number;
  period?: string;
  showIcon?: boolean;
  className?: string;
}

export function TrendIndicator({ value, period = "30d", showIcon = true, className }: TrendIndicatorProps) {
  const isPositive = value >= 0;
  const displayValue = Math.abs(value).toFixed(1);
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-medium",
      isPositive ? "text-executive-green" : "text-executive-red",
      className
    )}>
      {showIcon && (
        isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )
      )}
      <span>
        {isPositive ? "+" : "-"}{displayValue} pts vs {period}
      </span>
    </span>
  );
}
