import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Target } from "lucide-react";

interface ICPDonutChartProps {
  highFitAccounts: number;
  totalScored: number;
  className?: string;
}

export function ICPDonutChart({
  highFitAccounts,
  totalScored,
  className,
}: ICPDonutChartProps) {
  const highFitPercentage = totalScored > 0 
    ? Math.round((highFitAccounts / totalScored) * 100) 
    : 0;
  
  const otherAccounts = totalScored - highFitAccounts;

  const data = [
    { name: "High-Fit", value: highFitAccounts, color: "hsl(var(--primary))" },
    { name: "Other", value: otherAccounts, color: "hsl(var(--muted)/0.3)" },
  ];

  // Don't show if no data
  if (totalScored === 0) {
    return (
      <Card className={`${className} border-border/50 bg-card/80 backdrop-blur-sm`}>
        <CardContent className="flex flex-col items-center justify-center h-64 p-6">
          <Target className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No scored accounts yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/20 transition-colors duration-300`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">ICP Fit Score</span>
        </div>
        
        {/* Donut Chart */}
        <div className="relative h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                filter="url(#glow)"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-medium text-primary uppercase tracking-wider mb-1">ICP</span>
            <span className="text-5xl font-bold text-foreground">{highFitPercentage}%</span>
            <span className="text-xs text-muted-foreground mt-1">High-Fit</span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
            <span className="text-sm text-foreground font-medium">
              {highFitAccounts.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">High-Fit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-muted/50" />
            <span className="text-sm text-foreground font-medium">
              {otherAccounts.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Other</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
