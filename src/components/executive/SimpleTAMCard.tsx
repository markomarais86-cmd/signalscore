import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Globe, TrendingUp } from "lucide-react";

interface SimpleTAMCardProps {
  tamValue: number;
  totalAccounts: number;
  averageDealSize?: number;
  className?: string;
}

const chartData = [
  { value: 30 },
  { value: 45 },
  { value: 38 },
  { value: 52 },
  { value: 48 },
  { value: 62 },
  { value: 55 },
  { value: 70 },
  { value: 65 },
  { value: 78 },
];

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
  averageDealSize = 75000,
  className,
}: SimpleTAMCardProps) {
  // Calculate TAM if not provided
  const calculatedTAM = tamValue > 0 ? tamValue : totalAccounts * averageDealSize;

  return (
    <Card className={`${className} border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/20 transition-colors duration-300 overflow-hidden`}>
      <CardContent className="p-6 relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Total Addressable Market</span>
        </div>
        
        {/* Main content */}
        <div className="flex items-end justify-between relative z-10">
          <div className="space-y-1">
            <p className="text-5xl font-bold tracking-tight text-foreground">
              {formatCurrency(calculatedTAM)}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {totalAccounts.toLocaleString()} accounts
              </span>
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs font-medium">TAM</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background gradient chart */}
        <div className="absolute bottom-0 right-0 w-2/3 h-24 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tamGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#tamGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
