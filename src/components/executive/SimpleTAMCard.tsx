import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer } from "recharts";
import { Globe } from "lucide-react";

interface SimpleTAMCardProps {
  tamValue: number;
  totalAccounts: number;
  averageDealSize?: number;
  className?: string;
}

const miniChartData = [
  { value: 40 },
  { value: 55 },
  { value: 48 },
  { value: 65 },
  { value: 58 },
  { value: 72 },
  { value: 68 },
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
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Total Addressable Market
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight text-primary">
              {formatCurrency(calculatedTAM)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {totalAccounts.toLocaleString()} accounts
            </p>
          </div>
          <div className="w-24 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={miniChartData} barCategoryGap="15%">
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[2, 2, 0, 0]}
                  opacity={0.7}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
