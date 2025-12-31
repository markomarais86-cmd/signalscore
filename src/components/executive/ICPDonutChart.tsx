import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Target } from "lucide-react";

interface ICPDonutChartProps {
  highFitAccounts: number;
  medFitAccounts?: number;
  lowFitAccounts?: number;
  totalScored: number;
  className?: string;
}

export function ICPDonutChart({
  highFitAccounts,
  medFitAccounts = 0,
  lowFitAccounts = 0,
  totalScored,
  className,
}: ICPDonutChartProps) {
  const highFitPercentage = totalScored > 0 
    ? Math.round((highFitAccounts / totalScored) * 100) 
    : 0;
  
  // If med/low not provided, calculate "other"
  const hasBreakdown = medFitAccounts > 0 || lowFitAccounts > 0;
  const otherAccounts = totalScored - highFitAccounts;

  const data = hasBreakdown ? [
    { name: "High-Fit", value: highFitAccounts, color: "hsl(161 85% 60%)" },
    { name: "Medium-Fit", value: medFitAccounts, color: "hsl(43 96% 56%)" },
    { name: "Low-Fit", value: lowFitAccounts, color: "hsl(0 84% 60%)" },
  ] : [
    { name: "High-Fit", value: highFitAccounts, color: "hsl(161 85% 60%)" },
    { name: "Other", value: otherAccounts, color: "hsl(var(--muted)/0.4)" },
  ];

  if (totalScored === 0) {
    return (
      <Card className={`${className} floating-card border-border/50 bg-card/80 backdrop-blur-sm`}>
        <CardContent className="flex flex-col items-center justify-center h-64 p-6">
          <Target className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No scored accounts yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} floating-card border-border/30 bg-card/90 backdrop-blur-xl shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">ICP Fit Score</span>
        </div>
        
        {/* Donut Chart */}
        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <filter id="glow-enhanced">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
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
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                filter="url(#glow-enhanced)"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">ICP</span>
            <span className="text-5xl font-bold text-foreground">{highFitPercentage}%</span>
            <span className="text-xs text-muted-foreground mt-1">High-Fit</span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ 
                  backgroundColor: item.color,
                  boxShadow: `0 0 6px ${item.color}50`
                }}
              />
              <span className="text-sm text-foreground font-medium">
                {item.value.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}