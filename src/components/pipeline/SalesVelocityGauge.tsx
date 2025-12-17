import { TrendingUp, DollarSign, Target, Clock } from 'lucide-react';

interface SalesVelocityGaugeProps {
  velocity: number;
  winRate: number;
  avgCycle: number;
  pipelineValue: number;
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

export function SalesVelocityGauge({ velocity, winRate, avgCycle, pipelineValue }: SalesVelocityGaugeProps) {
  // Calculate velocity score (0-100) based on typical B2B benchmarks
  const velocityScore = Math.min(100, (velocity / 10000) * 100); // $10K/day = 100%

  return (
    <div className="space-y-6">
      {/* Main Velocity Display */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 border-primary/20 relative">
          <div 
            className="absolute inset-2 rounded-full border-8 border-primary"
            style={{
              clipPath: `polygon(0 0, 100% 0, 100% ${100 - velocityScore}%, 0 ${100 - velocityScore}%)`,
              transform: 'rotate(180deg)',
            }}
          />
          <div className="text-center z-10">
            <div className="text-2xl font-bold">{formatCurrency(velocity)}</div>
            <div className="text-xs text-muted-foreground">per day</div>
          </div>
        </div>
      </div>

      {/* Velocity Formula Breakdown */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="text-xs text-muted-foreground text-center mb-3">
          Velocity = (Pipeline × Win Rate) ÷ Sales Cycle
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="font-medium">{formatCurrency(pipelineValue)}</span>
          <span className="text-muted-foreground">×</span>
          <span className="font-medium">{winRate.toFixed(0)}%</span>
          <span className="text-muted-foreground">÷</span>
          <span className="font-medium">{avgCycle.toFixed(0)}d</span>
        </div>
      </div>

      {/* Component Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-lg font-semibold">{formatCurrency(pipelineValue)}</div>
          <div className="text-xs text-muted-foreground">Pipeline</div>
        </div>
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <Target className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-lg font-semibold">{winRate.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">Win Rate</div>
        </div>
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-lg font-semibold">{avgCycle.toFixed(0)}d</div>
          <div className="text-xs text-muted-foreground">Cycle</div>
        </div>
      </div>

      {/* Improvement Tips */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span>Increase pipeline or win rate to improve velocity</span>
        </p>
        <p className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Reduce sales cycle length for faster revenue</span>
        </p>
      </div>
    </div>
  );
}
