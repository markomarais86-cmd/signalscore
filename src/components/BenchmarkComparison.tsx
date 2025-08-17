import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BenchmarkData {
  metric: string;
  value: number;
  benchmark: number;
  unit: string;
  trend?: number;
}

interface BenchmarkComparisonProps {
  data: BenchmarkData[];
  title: string;
  description?: string;
}

export function BenchmarkComparison({ data, title, description }: BenchmarkComparisonProps) {
  const getTrendIcon = (trend?: number) => {
    if (!trend) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />;
    return <TrendingDown className="h-4 w-4 text-[hsl(var(--signal-low))]" />;
  };

  const getPerformanceColor = (value: number, benchmark: number) => {
    const ratio = value / benchmark;
    if (ratio >= 1.1) return "text-[hsl(var(--signal-high))]";
    if (ratio >= 0.9) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const getProgressValue = (value: number, benchmark: number) => {
    return Math.min((value / benchmark) * 100, 150); // Cap at 150% for display
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.metric}</span>
                  {getTrendIcon(item.trend)}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-lg font-bold ${getPerformanceColor(item.value, item.benchmark)}`}>
                      {item.value}{item.unit}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      vs {item.benchmark}{item.unit} avg
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <Progress 
                  value={getProgressValue(item.value, item.benchmark)}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0{item.unit}</span>
                  <span className="text-primary">Industry Avg: {item.benchmark}{item.unit}</span>
                  <span>{Math.max(item.value, item.benchmark * 1.5)}{item.unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}