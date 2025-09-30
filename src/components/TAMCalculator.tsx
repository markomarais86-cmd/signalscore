import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, DollarSign } from "lucide-react";

interface TAMSegment {
  segment: string;
  accounts: number;
  value: number;
  growth: number;
}

interface TAMCalculatorProps {
  data: TAMSegment[];
}

export function TAMCalculator({ data }: TAMCalculatorProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const totalAccounts = data.reduce((sum, segment) => sum + segment.accounts, 0);
  const totalValue = data.reduce((sum, segment) => sum + segment.value, 0);
  const avgGrowth = data.reduce((sum, segment) => sum + segment.growth, 0) / data.length;

  const getGrowthColor = (growth: number) => {
    if (growth >= 15) return "text-[hsl(var(--signal-high))]";
    if (growth >= 8) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const maxValue = Math.max(...data.map(s => s.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          TAM Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Total Addressable Market by segment with growth projections
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                {formatCurrency(totalValue)}
              </div>
              <div className="text-sm text-muted-foreground">Total TAM</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalAccounts.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Accounts</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getGrowthColor(avgGrowth)}`}>
                +{avgGrowth.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Growth</div>
            </div>
          </div>

          {/* Segment Breakdown */}
          <div className="space-y-4">
            {data.map((segment, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{segment.segment}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-[hsl(var(--primary))]">
                        {formatCurrency(segment.value)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {segment.accounts.toLocaleString()} accounts
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${getGrowthColor(segment.growth)}`}>
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-sm font-medium">+{segment.growth}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Progress 
                    value={(segment.value / maxValue) * 100}
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-xs">Market Share: {((segment.value / totalValue) * 100).toFixed(2)}%</span>
                    <span>Growth Rate: +{segment.growth}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}