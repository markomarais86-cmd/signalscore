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
        "border shadow-sm hover:shadow-md transition-all duration-200 bg-card",
        onClick && "cursor-pointer hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground opacity-60" />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-foreground">
            {value}
          </span>
          {subtitle && (
            <span className="text-sm text-muted-foreground font-medium">
              {subtitle}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
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
              "text-xs font-semibold px-2 py-1 rounded-full",
              trend.value > 0 
                ? "text-secondary bg-secondary/10" 
                : "text-destructive bg-destructive/10"
            )}>
              {trend.value > 0 ? "+" : ""}{trend.value.toFixed(2)}% {trend.period}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}