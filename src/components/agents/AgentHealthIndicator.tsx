import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface AgentHealthIndicatorProps {
  status: string;
  healthScore?: number | null;
  lastHeartbeat?: string | null;
  className?: string;
}

export function AgentHealthIndicator({ 
  status, 
  healthScore, 
  lastHeartbeat,
  className 
}: AgentHealthIndicatorProps) {
  const getHealthState = () => {
    if (status === "inactive") return "inactive";
    if (healthScore === null || healthScore === undefined) return "unknown";
    if (healthScore >= 0.8) return "healthy";
    if (healthScore >= 0.5) return "degraded";
    return "critical";
  };

  const healthState = getHealthState();

  const stateConfig = {
    healthy: {
      color: "text-green-500",
      bgColor: "bg-green-500",
      icon: CheckCircle,
      label: "Healthy",
      description: "Agent is operating normally",
    },
    degraded: {
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      icon: AlertTriangle,
      label: "Degraded",
      description: "Agent experiencing some issues",
    },
    critical: {
      color: "text-red-500",
      bgColor: "bg-red-500",
      icon: XCircle,
      label: "Critical",
      description: "Agent needs attention",
    },
    inactive: {
      color: "text-muted-foreground",
      bgColor: "bg-muted-foreground",
      icon: Activity,
      label: "Inactive",
      description: "Agent is not running",
    },
    unknown: {
      color: "text-muted-foreground",
      bgColor: "bg-muted-foreground",
      icon: Activity,
      label: "Unknown",
      description: "Health status unavailable",
    },
  };

  const config = stateConfig[healthState];
  const Icon = config.icon;

  const formatHeartbeat = () => {
    if (!lastHeartbeat) return "Never";
    const date = new Date(lastHeartbeat);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5", className)}>
            <div className="relative">
              <Icon className={cn("h-4 w-4", config.color)} />
              {healthState === "healthy" && status === "active" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    config.bgColor
                  )} />
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    config.bgColor
                  )} />
                </span>
              )}
            </div>
            {healthScore !== null && healthScore !== undefined && status !== "inactive" && (
              <span className={cn("text-xs font-medium", config.color)}>
                {Math.round(healthScore * 100)}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-muted-foreground">{config.description}</p>
            {lastHeartbeat && (
              <p className="text-muted-foreground">
                Last heartbeat: {formatHeartbeat()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
