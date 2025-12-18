import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2,
  RefreshCw,
  Info,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { 
  useAnomalies, 
  useAcknowledgeAnomaly, 
  useRunAnomalyDetection,
  DetectedAnomaly 
} from '@/hooks/use-anomalies';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const severityConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  critical: { 
    icon: <XCircle className="h-4 w-4" />, 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20'
  },
  high: { 
    icon: <AlertCircle className="h-4 w-4" />, 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20'
  },
  medium: { 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10 border-amber-500/20'
  },
  low: { 
    icon: <Info className="h-4 w-4" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-500/20'
  },
};

function formatMetricName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatMetricValue(value: number, metricName: string): string {
  if (metricName.includes('rate') || metricName.includes('percent')) {
    return `${value.toFixed(1)}%`;
  }
  if (metricName.includes('revenue') || metricName.includes('value') || metricName.includes('amount')) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  return value.toFixed(1);
}

interface AnomalyCardProps {
  anomaly: DetectedAnomaly;
  onAcknowledge: (id: string) => void;
  isLoading?: boolean;
}

function AnomalyCard({ anomaly, onAcknowledge, isLoading }: AnomalyCardProps) {
  const config = severityConfig[anomaly.severity] || severityConfig.low;
  const isNegative = (anomaly.deviation_percent || 0) < 0;
  
  return (
    <Card className={cn('border', config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5', config.color)}>
            {config.icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">
                {formatMetricName(anomaly.metric_name)}
              </h4>
              <Badge 
                variant="outline" 
                className={cn('text-xs capitalize', config.bgColor, config.color)}
              >
                {anomaly.severity}
              </Badge>
              {anomaly.acknowledged && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Acknowledged
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">
                  {formatMetricValue(anomaly.metric_value, anomaly.metric_name)}
                </span>
                {anomaly.deviation_percent !== null && (
                  <span className={cn(
                    'flex items-center text-sm font-medium',
                    isNegative ? 'text-destructive' : 'text-green-600'
                  )}>
                    {isNegative ? (
                      <TrendingDown className="h-4 w-4 mr-0.5" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-0.5" />
                    )}
                    {Math.abs(anomaly.deviation_percent).toFixed(1)}%
                  </span>
                )}
              </div>
              {anomaly.expected_value !== null && (
                <span className="text-xs text-muted-foreground">
                  Expected: {formatMetricValue(anomaly.expected_value, anomaly.metric_name)}
                </span>
              )}
            </div>
            
            {anomaly.explanation && (
              <p className="text-sm text-muted-foreground mb-2">
                {anomaly.explanation}
              </p>
            )}
            
            {anomaly.ai_recommendation && (
              <Alert className="mt-2 py-2">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-xs font-medium">AI Recommendation</AlertTitle>
                <AlertDescription className="text-xs">
                  {anomaly.ai_recommendation}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex items-center justify-between mt-3 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Detected {formatDistanceToNow(new Date(anomaly.created_at), { addSuffix: true })}
              </span>
              {!anomaly.acknowledged && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAcknowledge(anomaly.id)}
                  disabled={isLoading}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Acknowledge
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnomalyDashboard() {
  const { data: anomalies, isLoading, error } = useAnomalies({ acknowledged: false });
  const acknowledgeAnomaly = useAcknowledgeAnomaly();
  const runDetection = useRunAnomalyDetection();

  const handleAcknowledge = (id: string) => {
    acknowledgeAnomaly.mutate(id);
  };

  const handleRunDetection = () => {
    runDetection.mutate();
  };

  // Group anomalies by severity
  const groupedAnomalies = {
    critical: anomalies?.filter((a) => a.severity === 'critical') || [],
    high: anomalies?.filter((a) => a.severity === 'high') || [],
    medium: anomalies?.filter((a) => a.severity === 'medium') || [],
    low: anomalies?.filter((a) => a.severity === 'low') || [],
  };

  const totalUnacknowledged = anomalies?.length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive text-sm">Failed to load anomalies: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Anomaly Detection
            {totalUnacknowledged > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalUnacknowledged}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Metrics that deviate from expected patterns
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRunDetection}
          disabled={runDetection.isPending}
        >
          <RefreshCw className={cn(
            'h-4 w-4 mr-1',
            runDetection.isPending && 'animate-spin'
          )} />
          Run Detection
        </Button>
      </CardHeader>
      
      <CardContent>
        {totalUnacknowledged === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
            <p className="text-muted-foreground text-sm">No anomalies detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              All metrics are within expected ranges
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[450px] pr-4">
            <div className="space-y-4">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                const items = groupedAnomalies[severity];
                if (items.length === 0) return null;
                
                return (
                  <div key={severity}>
                    <h3 className={cn(
                      'text-sm font-medium mb-2 capitalize',
                      severityConfig[severity].color
                    )}>
                      {severity} Priority ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((anomaly) => (
                        <AnomalyCard
                          key={anomaly.id}
                          anomaly={anomaly}
                          onAcknowledge={handleAcknowledge}
                          isLoading={acknowledgeAnomaly.isPending}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
