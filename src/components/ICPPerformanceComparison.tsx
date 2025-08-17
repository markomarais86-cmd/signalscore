import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, TrendingUp, Users, DollarSign, Clock, AlertTriangle } from "lucide-react";

interface PerformanceMetrics {
  accounts: number;
  conversionRate: number;
  avgDealSize: number;
  salesCycle: number;
  churnRate: number;
}

interface ICPPerformanceData {
  icp: PerformanceMetrics;
  nonIcp: PerformanceMetrics;
}

interface ICPPerformanceComparisonProps {
  data: ICPPerformanceData;
}

export function ICPPerformanceComparison({ data }: ICPPerformanceComparisonProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const calculateImprovement = (icpValue: number, nonIcpValue: number, inverse = false) => {
    if (inverse) {
      return ((nonIcpValue - icpValue) / nonIcpValue) * 100;
    }
    return ((icpValue - nonIcpValue) / nonIcpValue) * 100;
  };

  const getImprovementColor = (improvement: number) => {
    if (improvement > 50) return "text-[hsl(var(--signal-high))]";
    if (improvement > 20) return "text-[hsl(var(--signal-medium))]";
    if (improvement > 0) return "text-[hsl(var(--primary))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const metrics = [
    {
      label: "Conversion Rate",
      icpValue: data.icp.conversionRate,
      nonIcpValue: data.nonIcp.conversionRate,
      format: (val: number) => `${val}%`,
      icon: <CheckCircle className="h-4 w-4" />,
      improvement: calculateImprovement(data.icp.conversionRate, data.nonIcp.conversionRate)
    },
    {
      label: "Avg Deal Size",
      icpValue: data.icp.avgDealSize,
      nonIcpValue: data.nonIcp.avgDealSize,
      format: formatCurrency,
      icon: <DollarSign className="h-4 w-4" />,
      improvement: calculateImprovement(data.icp.avgDealSize, data.nonIcp.avgDealSize)
    },
    {
      label: "Sales Cycle",
      icpValue: data.icp.salesCycle,
      nonIcpValue: data.nonIcp.salesCycle,
      format: (val: number) => `${val} days`,
      icon: <Clock className="h-4 w-4" />,
      improvement: calculateImprovement(data.icp.salesCycle, data.nonIcp.salesCycle, true),
      inverse: true
    },
    {
      label: "Churn Rate",
      icpValue: data.icp.churnRate,
      nonIcpValue: data.nonIcp.churnRate,
      format: (val: number) => `${val}%`,
      icon: <AlertTriangle className="h-4 w-4" />,
      improvement: calculateImprovement(data.icp.churnRate, data.nonIcp.churnRate, true),
      inverse: true
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          ICP vs Non-ICP Performance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Performance comparison showing the value of targeting ICP accounts
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Account Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--signal-high))]" />
                <span className="font-medium">ICP Accounts</span>
              </div>
              <div className="text-2xl font-bold">{data.icp.accounts.toLocaleString()}</div>
              <Badge className="bg-[hsl(var(--signal-high))] text-white mt-2">
                Target Segment
              </Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Non-ICP Accounts</span>
              </div>
              <div className="text-2xl font-bold">{data.nonIcp.accounts.toLocaleString()}</div>
              <Badge variant="secondary" className="mt-2">
                Other Accounts
              </Badge>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="space-y-4">
            {metrics.map((metric, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {metric.icon}
                    <span className="font-medium">{metric.label}</span>
                  </div>
                  <div className={`text-xs font-medium ${getImprovementColor(metric.improvement)}`}>
                    {metric.improvement > 0 ? '+' : ''}{metric.improvement.toFixed(1)}% 
                    {metric.inverse ? ' better' : ' higher'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ICP</span>
                      <span className="font-medium text-[hsl(var(--signal-high))]">
                        {metric.format(metric.icpValue)}
                      </span>
                    </div>
                    <Progress 
                      value={metric.inverse ? 
                        100 - (metric.icpValue / Math.max(metric.icpValue, metric.nonIcpValue)) * 100 :
                        (metric.icpValue / Math.max(metric.icpValue, metric.nonIcpValue)) * 100
                      }
                      className="h-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Non-ICP</span>
                      <span className="font-medium">
                        {metric.format(metric.nonIcpValue)}
                      </span>
                    </div>
                    <Progress 
                      value={metric.inverse ? 
                        100 - (metric.nonIcpValue / Math.max(metric.icpValue, metric.nonIcpValue)) * 100 :
                        (metric.nonIcpValue / Math.max(metric.icpValue, metric.nonIcpValue)) * 100
                      }
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Key Insights */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Key Insights
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• ICP accounts convert {(data.icp.conversionRate / data.nonIcp.conversionRate).toFixed(1)}x better</li>
              <li>• Average deal size is {((data.icp.avgDealSize / data.nonIcp.avgDealSize) * 100).toFixed(0)}% higher for ICP</li>
              <li>• Sales cycles are {Math.round(((data.nonIcp.salesCycle - data.icp.salesCycle) / data.nonIcp.salesCycle) * 100)}% shorter</li>
              <li>• Churn rate is {((data.nonIcp.churnRate / data.icp.churnRate)).toFixed(1)}x lower for ICP accounts</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}