import { usePipelineAnalytics } from '@/hooks/use-pipeline-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Target, Clock, AlertTriangle, PieChart } from 'lucide-react';
import { PipelineFunnelChart } from './PipelineFunnelChart';
import { SalesVelocityGauge } from './SalesVelocityGauge';
import { DealsAtRiskTable } from './DealsAtRiskTable';
import { LossReasonsChart } from './LossReasonsChart';

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, changeLabel, icon, trend }: MetricCardProps) {
  const getTrendColor = () => {
    if (!trend || trend === 'neutral') return 'text-muted-foreground';
    return trend === 'up' ? 'text-green-500' : 'text-red-500';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
            {TrendIcon && <TrendIcon className="h-3 w-3" />}
            <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
            {changeLabel && <span className="text-muted-foreground ml-1">{changeLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function PipelineAnalyticsDashboard() {
  const { metrics, isLoading, error } = usePipelineAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load pipeline metrics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No pipeline data available. Start by adding deals to your pipeline.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Pipeline Value"
          value={formatCurrency(metrics.totalPipelineValue)}
          change={metrics.pipelineGrowthRate}
          changeLabel="vs last period"
          icon={<DollarSign className="h-4 w-4" />}
          trend={metrics.pipelineGrowthRate > 0 ? 'up' : metrics.pipelineGrowthRate < 0 ? 'down' : 'neutral'}
        />
        <MetricCard
          title="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          change={metrics.winRateChange}
          changeLabel="vs last period"
          icon={<Target className="h-4 w-4" />}
          trend={metrics.winRateChange > 0 ? 'up' : metrics.winRateChange < 0 ? 'down' : 'neutral'}
        />
        <MetricCard
          title="Sales Velocity"
          value={`${formatCurrency(metrics.salesVelocity)}/day`}
          change={metrics.velocityChange}
          changeLabel="vs last period"
          icon={<TrendingUp className="h-4 w-4" />}
          trend={metrics.velocityChange > 0 ? 'up' : metrics.velocityChange < 0 ? 'down' : 'neutral'}
        />
        <MetricCard
          title="Avg Sales Cycle"
          value={`${metrics.avgSalesCycleDays.toFixed(0)} days`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Open Deals"
          value={metrics.totalOpenDeals.toString()}
          icon={<PieChart className="h-4 w-4" />}
        />
        <MetricCard
          title="Avg Deal Size"
          value={formatCurrency(metrics.avgDealSize)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Won This Period"
          value={`${metrics.wonDealsCount} (${formatCurrency(metrics.wonDealsValue)})`}
          icon={<Target className="h-4 w-4" />}
        />
        <MetricCard
          title="Slippage Rate"
          value={`${metrics.slippageRate.toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={metrics.slippageRate > 20 ? 'down' : metrics.slippageRate < 10 ? 'up' : 'neutral'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>Deals by stage with conversion rates</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineFunnelChart stages={metrics.stages} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Velocity</CardTitle>
            <CardDescription>Revenue generation efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesVelocityGauge 
              velocity={metrics.salesVelocity} 
              winRate={metrics.winRate}
              avgCycle={metrics.avgSalesCycleDays}
              pipelineValue={metrics.totalPipelineValue}
            />
          </CardContent>
        </Card>
      </div>

      {/* At Risk & Loss Reasons */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Deals at Risk
            </CardTitle>
            <CardDescription>
              {metrics.dealsAtRisk.length} deals need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DealsAtRiskTable deals={metrics.dealsAtRisk} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loss Reasons</CardTitle>
            <CardDescription>Why deals are being lost</CardDescription>
          </CardHeader>
          <CardContent>
            <LossReasonsChart reasons={metrics.lossReasons} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
