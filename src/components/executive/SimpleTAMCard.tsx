import { Card, CardContent } from "@/components/ui/card";
import { Globe, Target, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SimpleTAMCardProps {
  tamValue?: number;
  totalAccounts: number;
  highFitAccounts: number;
  campaignReadyAccounts: number;
  averageDealSize?: number;
  conversionRate?: number;
  className?: string;
}

function formatCurrency(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(1)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function SimpleTAMCard({
  tamValue,
  totalAccounts,
  highFitAccounts,
  campaignReadyAccounts,
  averageDealSize = 75000,
  conversionRate = 0.15,
  className,
}: SimpleTAMCardProps) {
  // TAM: Total Addressable Market - all accounts
  const tamAccounts = totalAccounts;
  const calculatedTAM = tamValue && tamValue > 0 ? tamValue : tamAccounts * averageDealSize;

  // SAM: Serviceable Addressable Market - high-fit accounts
  const samAccounts = highFitAccounts;
  const samValue = samAccounts * averageDealSize;
  const samPercentage = tamAccounts > 0 ? (samAccounts / tamAccounts) * 100 : 0;

  // SOM: Serviceable Obtainable Market - campaign ready with conversion rate
  const somAccounts = campaignReadyAccounts;
  const somValue = somAccounts * averageDealSize * conversionRate;
  const somPercentage = samAccounts > 0 ? (somAccounts / samAccounts) * 100 : 0;

  const segments = [
    {
      label: "TAM",
      sublabel: "Total Market",
      value: calculatedTAM,
      accounts: tamAccounts,
      percentage: 100,
      color: "hsl(var(--primary))",
    },
    {
      label: "SAM",
      sublabel: "Serviceable",
      value: samValue,
      accounts: samAccounts,
      percentage: samPercentage,
      color: "hsl(var(--chart-2))",
    },
    {
      label: "SOM",
      sublabel: "Obtainable",
      value: somValue,
      accounts: somAccounts,
      percentage: somPercentage,
      color: "hsl(var(--chart-3))",
    },
  ];

  return (
    <Card className={`${className} border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/20 transition-colors duration-300`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Market Sizing</span>
        </div>

        {/* TAM/SAM/SOM Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {segments.map((segment) => (
            <div key={segment.label} className="text-center">
              <p 
                className="text-2xl font-bold tracking-tight"
                style={{ color: segment.color }}
              >
                {formatCurrency(segment.value)}
              </p>
              <p className="text-xs font-medium text-foreground mt-1">{segment.label}</p>
              <p className="text-xs text-muted-foreground">{segment.accounts.toLocaleString()} accounts</p>
            </div>
          ))}
        </div>

        {/* Visual Funnel */}
        <div className="space-y-3">
          {segments.map((segment, index) => (
            <div key={segment.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{segment.sublabel}</span>
                {index > 0 && (
                  <span className="font-medium" style={{ color: segment.color }}>
                    {segment.percentage.toFixed(0)}% of {index === 1 ? 'TAM' : 'SAM'}
                  </span>
                )}
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${segment.percentage}%`,
                    backgroundColor: segment.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Key Insight */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span>
              {samPercentage >= 50 
                ? "Strong ICP alignment - high market opportunity"
                : samPercentage >= 25 
                  ? "Moderate ICP fit - consider refining criteria"
                  : "Low ICP coverage - review targeting strategy"
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
