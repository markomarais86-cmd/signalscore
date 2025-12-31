import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  Target, 
  RefreshCw, 
  X, 
  CheckCircle2,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { useIntentSignals, IntentSignal, IntentSignalType } from '@/hooks/useIntentSignals';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface IntentSignalsCardProps {
  orgId: string | undefined;
  className?: string;
}

const signalTypeConfig: Record<IntentSignalType, { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  engagement_velocity: {
    icon: TrendingUp,
    label: 'Engagement Velocity',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  multi_thread: {
    icon: Users,
    label: 'Multi-Thread',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  score_change: {
    icon: AlertTriangle,
    label: 'Score Change',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  coverage_gap: {
    icon: Target,
    label: 'Coverage Gap',
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
  },
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-gray-500 text-white',
};

export function IntentSignalsCard({ orgId, className }: IntentSignalsCardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | IntentSignalType>('all');
  
  const {
    signals,
    breakdown,
    isLoading,
    isComputing,
    computeSignals,
    dismissSignal,
    actionSignal,
  } = useIntentSignals(orgId);

  const filteredSignals = activeTab === 'all' 
    ? signals 
    : signals.filter(s => s.signal_type === activeTab);

  const totalSignals = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const handleAccountClick = (accountExternalId: string) => {
    navigate(`/accounts/${accountExternalId}`);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Intent Signals</CardTitle>
              <CardDescription>
                {totalSignals} actionable insights detected
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={computeSignals}
            disabled={isComputing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isComputing && "animate-spin")} />
            {isComputing ? 'Computing...' : 'Refresh'}
          </Button>
        </div>

        {/* Signal Type Summary */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {(Object.keys(signalTypeConfig) as IntentSignalType[]).map(type => {
            const config = signalTypeConfig[type];
            const Icon = config.icon;
            const count = breakdown[type];
            
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg transition-all",
                  config.bgColor,
                  activeTab === type && "ring-2 ring-primary"
                )}
              >
                <Icon className={cn("h-4 w-4 mb-1", config.color)} />
                <span className="text-lg font-semibold">{count}</span>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full mb-3">
            <TabsTrigger value="all" className="flex-1 text-xs">All ({totalSignals})</TabsTrigger>
            <TabsTrigger value="engagement_velocity" className="flex-1 text-xs">Velocity</TabsTrigger>
            <TabsTrigger value="multi_thread" className="flex-1 text-xs">Multi-Thread</TabsTrigger>
            <TabsTrigger value="score_change" className="flex-1 text-xs">Score</TabsTrigger>
            <TabsTrigger value="coverage_gap" className="flex-1 text-xs">Coverage</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px]">
            {filteredSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No {activeTab === 'all' ? '' : signalTypeConfig[activeTab as IntentSignalType].label.toLowerCase()} signals found
                </p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={computeSignals}
                  className="mt-2"
                >
                  Compute new signals
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSignals.map(signal => (
                  <SignalItem
                    key={signal.id}
                    signal={signal}
                    onDismiss={() => dismissSignal(signal.id)}
                    onAction={() => actionSignal(signal.id)}
                    onAccountClick={() => handleAccountClick(signal.account_external_id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface SignalItemProps {
  signal: IntentSignal;
  onDismiss: () => void;
  onAction: () => void;
  onAccountClick: () => void;
}

function SignalItem({ signal, onDismiss, onAction, onAccountClick }: SignalItemProps) {
  const config = signalTypeConfig[signal.signal_type];
  const Icon = config.icon;

  return (
    <div className={cn(
      "p-3 rounded-lg border transition-all hover:shadow-sm",
      config.bgColor,
      "border-border/50"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded", config.bgColor)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onAccountClick}
              className="font-medium text-sm hover:underline truncate"
            >
              {signal.account_name || signal.account_external_id}
            </button>
            <Badge className={cn("text-[10px] px-1.5 py-0", priorityColors[signal.signal_priority])}>
              {signal.signal_priority}
            </Badge>
          </div>
          
          <p className="text-sm font-medium text-foreground">
            {signal.title}
          </p>
          
          {signal.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {signal.description}
            </p>
          )}

          {/* Metadata Display */}
          {signal.metadata && Object.keys(signal.metadata).length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {signal.metadata.increase_percent && (
                <Badge variant="outline" className="text-[10px]">
                  +{signal.metadata.increase_percent}%
                </Badge>
              )}
              {signal.metadata.employee_count && (
                <Badge variant="outline" className="text-[10px]">
                  {signal.metadata.employee_count} employees
                </Badge>
              )}
              {signal.metadata.lead_count && (
                <Badge variant="outline" className="text-[10px]">
                  {signal.metadata.lead_count} contact{signal.metadata.lead_count > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAction}
            title="Mark as actioned"
          >
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAccountClick}
            title="View account"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDismiss}
            title="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}
