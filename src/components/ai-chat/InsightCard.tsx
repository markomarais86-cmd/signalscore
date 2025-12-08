import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export interface InsightData {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  type?: 'success' | 'warning' | 'danger' | 'info';
  progress?: number;
  breakdown?: Array<{ label: string; value: number; color?: string }>;
}

interface InsightCardProps {
  insight: InsightData;
  compact?: boolean;
}

function getTrendIcon(trend?: 'up' | 'down' | 'neutral') {
  switch (trend) {
    case 'up': return <TrendingUp className="w-3 h-3 text-[hsl(var(--status-success))]" />;
    case 'down': return <TrendingDown className="w-3 h-3 text-[hsl(var(--status-danger))]" />;
    default: return <Minus className="w-3 h-3 text-muted-foreground" />;
  }
}

function getTypeIcon(type?: 'success' | 'warning' | 'danger' | 'info') {
  switch (type) {
    case 'success': return <CheckCircle className="w-4 h-4 text-[hsl(var(--status-success))]" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))]" />;
    case 'danger': return <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-danger))]" />;
    default: return <Info className="w-4 h-4 text-primary" />;
  }
}

function getTypeBorderColor(type?: 'success' | 'warning' | 'danger' | 'info') {
  switch (type) {
    case 'success': return 'border-l-[hsl(var(--status-success))]';
    case 'warning': return 'border-l-[hsl(var(--status-warning))]';
    case 'danger': return 'border-l-[hsl(var(--status-danger))]';
    default: return 'border-l-primary';
  }
}

export function InsightCard({ insight, compact = false }: InsightCardProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {getTypeIcon(insight.type)}
          <span className="text-sm text-muted-foreground">{insight.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm">{insight.value}</span>
          {insight.trend && getTrendIcon(insight.trend)}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'p-3 bg-card rounded-lg border border-border border-l-4 shadow-sm',
      getTypeBorderColor(insight.type)
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {getTypeIcon(insight.type)}
          <span className="text-sm text-muted-foreground">{insight.title}</span>
        </div>
        {insight.trend && (
          <div className="flex items-center gap-1 text-xs">
            {getTrendIcon(insight.trend)}
            {insight.trendValue && (
              <span className={cn(
                insight.trend === 'up' ? 'text-[hsl(var(--status-success))]' : 
                insight.trend === 'down' ? 'text-[hsl(var(--status-danger))]' : 
                'text-muted-foreground'
              )}>
                {insight.trendValue}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{insight.value}</span>
        {insight.subtitle && (
          <span className="text-xs text-muted-foreground">{insight.subtitle}</span>
        )}
      </div>

      {/* Progress */}
      {insight.progress !== undefined && (
        <div className="mt-2">
          <Progress value={insight.progress} className="h-1.5" />
        </div>
      )}

      {/* Breakdown */}
      {insight.breakdown && insight.breakdown.length > 0 && (
        <div className="mt-2 space-y-1">
          {insight.breakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface InsightGridProps {
  insights: InsightData[];
  columns?: 2 | 3;
}

export function InsightGrid({ insights, columns = 2 }: InsightGridProps) {
  return (
    <div className={cn(
      'grid gap-2',
      columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
    )}>
      {insights.map((insight, i) => (
        <InsightCard key={i} insight={insight} compact />
      ))}
    </div>
  );
}

interface AnalyticsSummaryProps {
  title: string;
  description?: string;
  insights: InsightData[];
  recommendations?: string[];
}

export function AnalyticsSummary({ title, description, insights, recommendations }: AnalyticsSummaryProps) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">{title}</h4>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>

      {recommendations && recommendations.length > 0 && (
        <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-xs font-medium text-primary mb-1">Recommendations:</p>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
