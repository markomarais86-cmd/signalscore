import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SyncStatusBadgeProps {
  provider: string;
  lastSyncedAt?: string;
  syncStatus?: 'success' | 'error' | 'syncing';
  onClick?: () => void;
}

export function SyncStatusBadge({ provider, lastSyncedAt, syncStatus, onClick }: SyncStatusBadgeProps) {
  const getIcon = () => {
    switch (syncStatus) {
      case 'success':
        return <CheckCircle className="h-3 w-3" />;
      case 'error':
        return <AlertCircle className="h-3 w-3" />;
      case 'syncing':
        return <RefreshCw className="h-3 w-3 animate-spin" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getVariant = () => {
    switch (syncStatus) {
      case 'success':
        return 'default' as const;
      case 'error':
        return 'destructive' as const;
      case 'syncing':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const getLabel = () => {
    if (syncStatus === 'syncing') return `${provider}: Syncing...`;
    if (!lastSyncedAt) return `${provider}: Never synced`;
    
    const timeAgo = formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true });
    return `${provider}: ${timeAgo}`;
  };

  if (onClick) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-2 text-xs"
        onClick={onClick}
      >
        {getIcon()}
        {getLabel()}
      </Button>
    );
  }

  return (
    <Badge variant={getVariant()} className="gap-1.5 text-xs font-normal">
      {getIcon()}
      {getLabel()}
    </Badge>
  );
}
