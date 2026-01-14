import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Database, Zap } from 'lucide-react';
import { LaunchPulseMark } from '@/components/BrandLogo';

interface SourceMetrics {
  attempted: number;
  enriched: number;
  failed: number;
}

interface EnrichmentSourceBreakdownProps {
  sourceBreakdown: {
    apollo: SourceMetrics;
    pdl: SourceMetrics;
    ai: SourceMetrics;
    launch_pulse?: SourceMetrics;
  };
}

// Custom wrapper component for LaunchPulseMark to match lucide icon interface
const LaunchPulseIcon = ({ className }: { className?: string }) => (
  <LaunchPulseMark className={className} />
);

const sourceConfig = {
  apollo: {
    label: 'Apollo',
    icon: Database,
    color: 'bg-blue-500',
    lightColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  pdl: {
    label: 'People Data Labs',
    icon: Zap,
    color: 'bg-purple-500',
    lightColor: 'bg-purple-100',
    textColor: 'text-purple-700',
  },
  ai: {
    label: 'Launch Pulse',
    icon: LaunchPulseIcon,
    color: 'bg-primary',
    lightColor: 'bg-primary/10',
    textColor: 'text-primary',
  },
  launch_pulse: {
    label: 'Launch Pulse',
    icon: LaunchPulseIcon,
    color: 'bg-primary',
    lightColor: 'bg-primary/10',
    textColor: 'text-primary',
  },
};

export function EnrichmentSourceBreakdown({ sourceBreakdown }: EnrichmentSourceBreakdownProps) {
  const totalEnriched = useMemo(() => {
    return sourceBreakdown.apollo.enriched + sourceBreakdown.pdl.enriched + sourceBreakdown.ai.enriched;
  }, [sourceBreakdown]);

  const calculatePercentage = (value: number) => {
    if (totalEnriched === 0) return 0;
    return Math.round((value / totalEnriched) * 100);
  };

  const calculateSuccessRate = (metrics: SourceMetrics) => {
    if (metrics.attempted === 0) return 0;
    return Math.round((metrics.enriched / metrics.attempted) * 100);
  };

  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 80) {
      return <Badge className="bg-green-500/10 text-green-700 border-green-200">{rate}%</Badge>;
    }
    if (rate >= 60) {
      return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">{rate}%</Badge>;
    }
    return <Badge className="bg-red-500/10 text-red-700 border-red-200">{rate}%</Badge>;
  };

  if (totalEnriched === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Source Breakdown</h3>
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Distribution Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enrichment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.entries(sourceBreakdown) as [keyof typeof sourceConfig, SourceMetrics][]).map(([key, metrics]) => {
              const config = sourceConfig[key];
              const percentage = calculatePercentage(metrics.enriched);
              
              if (metrics.enriched === 0) return null;
              
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <config.icon className={`h-4 w-4 ${config.textColor}`} />
                      <span>{config.label}</span>
                    </div>
                    <span className="font-medium">
                      {metrics.enriched.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className={`h-full ${config.color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Success Rates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rates by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(Object.entries(sourceBreakdown) as [keyof typeof sourceConfig, SourceMetrics][]).map(([key, metrics]) => {
                const config = sourceConfig[key];
                const successRate = calculateSuccessRate(metrics);
                
                if (metrics.attempted === 0) return null;
                
                return (
                  <div 
                    key={key} 
                    className={`flex items-center justify-between p-3 rounded-lg ${config.lightColor}`}
                  >
                    <div className="flex items-center gap-2">
                      <config.icon className={`h-4 w-4 ${config.textColor}`} />
                      <div>
                        <p className={`font-medium ${config.textColor}`}>{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {metrics.enriched.toLocaleString()} of {metrics.attempted.toLocaleString()} attempts
                        </p>
                      </div>
                    </div>
                    {getSuccessRateBadge(successRate)}
                  </div>
                );
              })}
              
              {/* Overall */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted border-t mt-2 pt-3">
                <div>
                  <p className="font-medium">Overall</p>
                  <p className="text-xs text-muted-foreground">
                    {totalEnriched.toLocaleString()} total enriched
                  </p>
                </div>
                {getSuccessRateBadge(
                  calculateSuccessRate({
                    attempted: sourceBreakdown.apollo.attempted + sourceBreakdown.pdl.attempted + sourceBreakdown.ai.attempted,
                    enriched: totalEnriched,
                    failed: sourceBreakdown.apollo.failed + sourceBreakdown.pdl.failed + sourceBreakdown.ai.failed,
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
