import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface HeroMetricProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    period: string;
  };
  icon?: LucideIcon;
  chart?: {
    data: Array<{ value: number }>;
    color?: string;
  };
  status?: 'success' | 'warning' | 'danger' | 'default';
}

export function HeroMetric({ 
  label, 
  value, 
  subtitle, 
  trend, 
  icon: Icon,
  chart,
  status = 'default'
}: HeroMetricProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-5 w-5" />;
    if (trend.value < 0) return <TrendingDown className="h-5 w-5" />;
    return <Minus className="h-5 w-5" />;
  };

  const getTrendColor = () => {
    if (!trend) return 'text-muted-foreground';
    if (trend.value > 0) return 'text-[hsl(var(--signal-high))]';
    if (trend.value < 0) return 'text-[hsl(var(--signal-low))]';
    return 'text-muted-foreground';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'border-l-[hsl(var(--signal-high))]';
      case 'warning': return 'border-l-[hsl(var(--signal-medium))]';
      case 'danger': return 'border-l-[hsl(var(--signal-low))]';
      default: return 'border-l-primary';
    }
  };

  return (
    <Card className={`relative overflow-hidden border-l-4 ${getStatusColor()} hover:shadow-lg transition-all duration-300`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-5xl font-bold tracking-tight mb-1">{value}</div>
            {trend && (
              <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{Math.abs(trend.value).toFixed(2)}% vs {trend.period}</span>
              </div>
            )}
          </div>

          {chart && (
            <div className="w-32 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart.data}>
                  <defs>
                    <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.color || "hsl(var(--primary))"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chart.color || "hsl(var(--primary))"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chart.color || "hsl(var(--primary))"}
                    strokeWidth={2}
                    fill="url(#heroGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
