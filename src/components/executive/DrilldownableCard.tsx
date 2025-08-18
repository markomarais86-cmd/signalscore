import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "./StatusIndicator";
import { ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrilldownItem {
  id: string;
  name: string;
  value: number;
  subtitle?: string;
  status: number;
  trend?: number;
  children?: DrilldownItem[];
}

interface DrilldownableCardProps {
  title: string;
  data: DrilldownItem[];
  onDrillDown: (itemId: string, item: DrilldownItem) => void;
  onExport?: () => void;
  threshold?: { low: number; medium: number; high: number };
  className?: string;
}

export function DrilldownableCard({
  title,
  data,
  onDrillDown,
  onExport,
  threshold = { low: 30, medium: 60, high: 80 },
  className
}: DrilldownableCardProps) {
  const formatValue = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <Card className={cn("border-0 shadow-[var(--shadow-card)]", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="h-8 px-3"
            >
              <Download className="h-3 w-3 mr-2" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-1">
          {data.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
              onClick={() => onDrillDown(item.id, item)}
            >
              <div className="flex items-center gap-4">
                <StatusIndicator
                  value={item.status}
                  threshold={threshold}
                  size="sm"
                />
                
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-xs text-muted-foreground">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold">
                    {formatValue(item.value)}
                  </div>
                  {item.trend && (
                    <div className={cn(
                      "text-xs",
                      item.trend > 0 ? "text-[hsl(var(--executive-green))]" : "text-[hsl(var(--executive-red))]"
                    )}>
                      {item.trend > 0 ? "+" : ""}{item.trend}%
                    </div>
                  )}
                </div>
                
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}