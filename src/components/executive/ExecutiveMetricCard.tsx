import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusIndicator } from "./StatusIndicator";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ExecutiveMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  status?: {
    value: number;
    threshold: { low: number; medium: number; high: number };
  };
  trend?: {
    value: number;
    period: string;
  };
  onClick?: () => void;
  className?: string;
}

export function ExecutiveMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  status,
  trend,
  onClick,
  className
}: ExecutiveMetricCardProps) {
  return (
    <Card 
      className={cn(
        "border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-executive)] transition-all duration-200",
        onClick && "cursor-pointer hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {value}
          </span>
          {subtitle && (
            <span className="text-sm text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          {status && (
            <StatusIndicator
              value={status.value}
              threshold={status.threshold}
              showTrend={false}
              size="sm"
            />
          )}
          
          {trend && (
            <div className={cn(
              "text-xs font-medium",
              trend.value > 0 ? "text-[hsl(var(--executive-green))]" : "text-[hsl(var(--executive-red))]"
            )}>
              {trend.value > 0 ? "+" : ""}{trend.value}% {trend.period}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}