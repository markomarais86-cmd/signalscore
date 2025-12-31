import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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
    { name: "Other", value: otherAccounts, color: "hsl(var(--muted))" },
  ];

  // Don't show if no data
  if (totalScored === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">ICP Fit</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground text-sm">No scored accounts yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">ICP Fit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-primary">{highFitPercentage}%</span>
            <span className="text-xs text-muted-foreground">High-Fit</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">
              {highFitAccounts.toLocaleString()} High-Fit
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <span className="text-sm text-muted-foreground">
              {otherAccounts.toLocaleString()} Other
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
