import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { HealthStatus } from "@/hooks/use-provider-health";
import { cn } from "@/lib/utils";

interface ProviderHealthBadgeProps {
  status: HealthStatus;
  isLoading?: boolean;
  avgResponseTimeMs?: number | null;
  failureCount?: number;
  className?: string;
}

export function ProviderHealthBadge({ 
  status, 
  isLoading,
  avgResponseTimeMs, 
  failureCount,
  className 
}: ProviderHealthBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  const config = {
    healthy: {
      icon: CheckCircle2,
      label: "Active",
      variant: "default" as const,
      className: "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20",
    },
    degraded: {
      icon: AlertCircle,
      label: "Degraded",
      variant: "secondary" as const,
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20",
    },
    down: {
      icon: XCircle,
      label: "Unavailable",
      variant: "destructive" as const,
      className: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20",
    },
  };

  const { icon: Icon, label, className: statusClassName } = config[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn("gap-1 cursor-help", statusClassName, className)}
          >
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p><strong>Status:</strong> {label}</p>
            {avgResponseTimeMs && (
              <p><strong>Avg Response:</strong> {avgResponseTimeMs.toFixed(0)}ms</p>
            )}
            {failureCount !== undefined && failureCount > 0 && (
              <p><strong>Recent Failures:</strong> {failureCount}</p>
            )}
            {status === 'down' && (
              <p className="text-red-400">Circuit breaker is open - provider temporarily disabled</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
