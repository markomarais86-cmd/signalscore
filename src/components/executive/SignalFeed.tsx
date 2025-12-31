import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock,
  DollarSign,
  X,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Zap
} from "lucide-react";
import { useAccountSignals, AccountSignal } from "@/hooks/useAccountSignals";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const signalTypeConfig: Record<string, { icon: typeof AlertTriangle; label: string }> = {
  no_contacts: { icon: Users, label: 'No Contacts' },
  multi_thread_gap: { icon: Users, label: 'Multi-Thread' },
  stale_engagement: { icon: Clock, label: 'Stale' },
  score_velocity_up: { icon: TrendingUp, label: 'Score Up' },
  score_velocity_down: { icon: TrendingDown, label: 'Score Down' },
  new_high_fit: { icon: Sparkles, label: 'New High-Fit' },
  contact_stale: { icon: Clock, label: 'Stale Data' },
  funding_event: { icon: DollarSign, label: 'Funding' },
};

const priorityConfig = {
  critical: { color: 'bg-destructive text-destructive-foreground', border: 'border-l-destructive' },
  high: { color: 'bg-orange-500/20 text-orange-700 dark:text-orange-300', border: 'border-l-orange-500' },
  medium: { color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300', border: 'border-l-blue-500' },
  low: { color: 'bg-muted text-muted-foreground', border: 'border-l-muted-foreground' },
};

interface SignalCardProps {
  signal: AccountSignal;
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  onViewAccount: (accountId: string) => void;
}

function SignalCard({ signal, onDismiss, onAction, onViewAccount }: SignalCardProps) {
  const config = signalTypeConfig[signal.signal_type] || { icon: Zap, label: signal.signal_type };
  const priority = priorityConfig[signal.signal_priority];
  const Icon = config.icon;

  const handleViewAccount = () => {
    onAction(signal.id);
    onViewAccount(signal.account_external_id);
  };

  return (
    <div 
      className={cn(
        "p-3 border-l-4 bg-card rounded-r-lg hover:bg-accent/30 transition-colors",
        priority.border
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-md", priority.color)}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {signal.signal_priority.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {config.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
            </span>
          </div>
          
          <h4 className="text-sm font-medium line-clamp-1">{signal.title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {signal.description}
          </p>
          
          <div className="flex items-center gap-2 mt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-xs px-2"
              onClick={handleViewAccount}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Account
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-xs px-2 text-muted-foreground"
              onClick={() => onDismiss(signal.id)}
            >
              <X className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SignalFeedProps {
  maxHeight?: string;
  showHeader?: boolean;
  compact?: boolean;
}

export function SignalFeed({ maxHeight = "400px", showHeader = true, compact = false }: SignalFeedProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'critical' | 'opportunities' | 'risks'>('all');
  
  const { signals, summary, isLoading, dismissSignal, actionSignal, detectSignals, isDetecting } = useAccountSignals();

  const filteredSignals = signals.filter(signal => {
    if (filter === 'all') return true;
    if (filter === 'critical') return signal.signal_priority === 'critical';
    if (filter === 'opportunities') return ['new_high_fit', 'score_velocity_up', 'funding_event'].includes(signal.signal_type);
    if (filter === 'risks') return ['score_velocity_down', 'stale_engagement', 'no_contacts', 'multi_thread_gap'].includes(signal.signal_type);
    return true;
  });

  const handleViewAccount = (accountId: string) => {
    navigate(`/accounts?search=${accountId}`);
  };

  if (isLoading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Signals
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Signals Today
              {summary.critical > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5">
                  {summary.critical} critical
                </Badge>
              )}
            </CardTitle>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-xs"
              onClick={() => detectSignals()}
              disabled={isDetecting}
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isDetecting && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="pt-0">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-3">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-2 h-6">
              All ({summary.total})
            </TabsTrigger>
            <TabsTrigger value="critical" className="text-xs px-2 h-6">
              Critical ({summary.critical})
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="text-xs px-2 h-6">
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="risks" className="text-xs px-2 h-6">
              Risks
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredSignals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No signals detected</p>
            <p className="text-xs mt-1">Click refresh to detect new signals</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-2">
            <div className="space-y-2">
              {filteredSignals.map(signal => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onDismiss={dismissSignal}
                  onAction={actionSignal}
                  onViewAccount={handleViewAccount}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
