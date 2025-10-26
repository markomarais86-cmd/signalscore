import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, DollarSign, Target, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TAMSegment {
  label: string;
  accounts: number;
  value: number;
  percentage: number;
  description: string;
  color: string;
}

interface TAMSAMSOMCalculatorProps {
  totalAccounts: number;
  highFitAccounts: number;
  campaignReadyAccounts: number;
  averageDealSize?: number;
  conversionRate?: number;
}

export function TAMSAMSOMCalculator({
  totalAccounts,
  highFitAccounts,
  campaignReadyAccounts,
  averageDealSize = 75000,
  conversionRate = 0.15
}: TAMSAMSOMCalculatorProps) {
  // TAM: Total Addressable Market - ALL accounts in database
  const tamAccounts = totalAccounts;
  const tamValue = tamAccounts * averageDealSize;

  // SAM: Serviceable Addressable Market - Accounts matching ICP (high fit)
  const samAccounts = highFitAccounts;
  const samValue = samAccounts * averageDealSize;
  const samPercentage = totalAccounts > 0 ? (samAccounts / tamAccounts) * 100 : 0;

  // SOM: Serviceable Obtainable Market - Campaign ready (high fit + contacts)
  const somAccounts = campaignReadyAccounts;
  const somValue = somAccounts * averageDealSize * conversionRate;
  const somPercentage = highFitAccounts > 0 ? (somAccounts / samAccounts) * 100 : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const segments: TAMSegment[] = [
    {
      label: "TAM",
      accounts: tamAccounts,
      value: tamValue,
      percentage: 100,
      description: "Total Addressable Market - All accounts in database",
      color: "hsl(var(--chart-1))"
    },
    {
      label: "SAM",
      accounts: samAccounts,
      value: samValue,
      percentage: samPercentage,
      description: "Serviceable Addressable Market - Accounts matching ICP criteria",
      color: "hsl(var(--chart-2))"
    },
    {
      label: "SOM",
      accounts: somAccounts,
      value: somValue,
      percentage: somPercentage,
      description: "Serviceable Obtainable Market - Campaign ready (realistic 12-month target)",
      color: "hsl(var(--chart-3))"
    }
  ];

  const getMarketHealthColor = (percentage: number) => {
    if (percentage >= 60) return "text-[hsl(var(--signal-high))]";
    if (percentage >= 30) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          TAM/SAM/SOM Analysis
        </CardTitle>
        <CardDescription>
          Market opportunity sizing based on ICP fit and campaign readiness
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Market Size Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                {formatCurrency(tamValue)}
              </div>
              <div className="text-sm text-muted-foreground">Total Market (TAM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {tamAccounts.toLocaleString()} accounts
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--chart-2))]">
                {formatCurrency(samValue)}
              </div>
              <div className="text-sm text-muted-foreground">Serviceable (SAM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {samAccounts.toLocaleString()} high-fit
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--chart-3))]">
                {formatCurrency(somValue)}
              </div>
              <div className="text-sm text-muted-foreground">Obtainable (SOM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {somAccounts.toLocaleString()} ready
              </div>
            </div>
          </div>

          {/* Market Funnel Visualization */}
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={segment.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      style={{ borderColor: segment.color, color: segment.color }}
                    >
                      {segment.label}
                    </Badge>
                    <span className="text-sm font-medium">{segment.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold" style={{ color: segment.color }}>
                        {formatCurrency(segment.value)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {segment.accounts.toLocaleString()} accounts
                      </div>
                    </div>
                    {index > 0 && (
                      <div className={`text-sm font-medium ${getMarketHealthColor(segment.percentage)}`}>
                        {segment.percentage.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={segment.percentage}
                  className="h-3"
                  style={{
                    // @ts-ignore
                    '--progress-background': segment.color
                  }}
                />
                
                {index === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Methodology: Bottom-up calculation based on actual database accounts
                  </div>
                )}
                {index === 1 && (
                  <div className="text-xs text-muted-foreground">
                    {samPercentage.toFixed(0)}% of TAM matches your ICP criteria
                  </div>
                )}
                {index === 2 && (
                  <div className="text-xs text-muted-foreground">
                    Assumes {(conversionRate * 100).toFixed(0)}% conversion rate over 12 months
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Key Insights */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />
              <span className="font-medium">Market Opportunity:</span>
              <span className="text-muted-foreground">
                {samPercentage >= 50 
                  ? "Strong ICP match - majority of accounts are high-fit"
                  : samPercentage >= 30
                  ? "Good targeting - significant addressable market"
                  : "Consider refining ICP or expanding data sources"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-[hsl(var(--chart-3))]" />
              <span className="font-medium">12-Month Target:</span>
              <span className="text-muted-foreground">
                {formatCurrency(somValue)} from {somAccounts} campaign-ready accounts
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-[hsl(var(--chart-2))]" />
              <span className="font-medium">Campaign Readiness:</span>
              <span className="text-muted-foreground">
                {somPercentage.toFixed(0)}% of high-fit accounts have contact data
              </span>
            </div>
          </div>

          {/* Assumptions */}
          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Assumptions:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Average Deal Size: {formatCurrency(averageDealSize)}</li>
                <li>12-Month Conversion Rate: {(conversionRate * 100).toFixed(0)}%</li>
                <li>High-fit defined as ICP match score ≥ 70</li>
                <li>Campaign ready = High-fit + valid contact data</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
