import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FitDistributionHeroProps {
  highFitAccounts: number;
  mediumFitAccounts: number;
  lowFitAccounts: number;
  totalScored: number;
  highFitTrend?: number;
  mediumFitTrend?: number;
  lowFitTrend?: number;
  highFitPercentageTrend?: number;
  mediumFitPercentageTrend?: number;
  lowFitPercentageTrend?: number;
}

export function FitDistributionHero({
  highFitAccounts,
  mediumFitAccounts,
  lowFitAccounts,
  totalScored,
  highFitTrend = 0,
  mediumFitTrend = 0,
  lowFitTrend = 0,
  highFitPercentageTrend = 0,
  mediumFitPercentageTrend = 0,
  lowFitPercentageTrend = 0,
}: FitDistributionHeroProps) {
  const navigate = useNavigate();

  const highFitPct = totalScored > 0 ? Math.round((highFitAccounts / totalScored) * 100) : 0;
  const mediumFitPct = totalScored > 0 ? Math.round((mediumFitAccounts / totalScored) * 100) : 0;
  const lowFitPct = totalScored > 0 ? Math.round((lowFitAccounts / totalScored) * 100) : 0;

  const TrendIcon = ({ value }: { value: number }) => {
    if (value === 0) return null;
    return value > 0 ? (
      <TrendingUp className="h-3 w-3 text-executive-green" />
    ) : (
      <TrendingDown className="h-3 w-3 text-executive-red" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          ICP Fit Distribution
        </CardTitle>
        <CardDescription>
          Account quality breakdown across your scored database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* High Fit */}
          <div
            className="relative z-10 cursor-pointer hover:bg-muted/50 p-4 rounded-lg transition-colors border-2 border-fit-high/20 bg-fit-high/5"
            onClick={() => navigate('/accounts?fit=high')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">High Fit</div>
              <Badge className="bg-fit-high text-fit-high-foreground border-fit-high">
                Score ≥ 70
              </Badge>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-3xl font-bold text-fit-high">
                {highFitAccounts.toLocaleString()}
              </div>
              <div className="text-lg text-muted-foreground">
                ({highFitPct}%)
              </div>
            </div>
            {highFitTrend !== 0 && (
              <div className="flex items-center gap-1 text-xs mt-2">
                <TrendIcon value={highFitTrend} />
                <span className={cn(
                  "font-medium",
                  highFitTrend > 0 ? "text-executive-green" : "text-executive-red"
                )}>
                  {highFitTrend > 0 ? "+" : ""}{highFitTrend} accounts
                </span>
                {highFitPercentageTrend !== 0 && (
                  <span className="text-muted-foreground">
                    ({highFitPercentageTrend > 0 ? "+" : ""}{highFitPercentageTrend.toFixed(1)}% pts)
                  </span>
                )}
                <span className="text-muted-foreground">vs last week</span>
              </div>
            )}
          </div>

          {/* Medium Fit */}
          <div
            className="relative z-10 cursor-pointer hover:bg-muted/50 p-4 rounded-lg transition-colors border-2 border-fit-medium/20 bg-fit-medium/5"
            onClick={() => navigate('/accounts?fit=medium')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Medium Fit</div>
              <Badge className="bg-fit-medium text-fit-medium-foreground border-fit-medium">
                Score 40-69
              </Badge>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-3xl font-bold text-fit-medium">
                {mediumFitAccounts.toLocaleString()}
              </div>
              <div className="text-lg text-muted-foreground">
                ({mediumFitPct}%)
              </div>
            </div>
            {mediumFitTrend !== 0 && (
              <div className="flex items-center gap-1 text-xs mt-2">
                <TrendIcon value={mediumFitTrend} />
                <span className={cn(
                  "font-medium",
                  mediumFitTrend > 0 ? "text-executive-green" : "text-executive-red"
                )}>
                  {mediumFitTrend > 0 ? "+" : ""}{mediumFitTrend} accounts
                </span>
                {mediumFitPercentageTrend !== 0 && (
                  <span className="text-muted-foreground">
                    ({mediumFitPercentageTrend > 0 ? "+" : ""}{mediumFitPercentageTrend.toFixed(1)}% pts)
                  </span>
                )}
                <span className="text-muted-foreground">vs last week</span>
              </div>
            )}
          </div>

          {/* Low Fit */}
          <div
            className="relative z-10 cursor-pointer hover:bg-muted/50 p-4 rounded-lg transition-colors border-2 border-fit-low/20 bg-fit-low/5"
            onClick={() => navigate('/accounts?fit=low')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Low Fit</div>
              <Badge className="bg-fit-low text-fit-low-foreground border-fit-low">
                Score &lt; 40
              </Badge>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-3xl font-bold text-fit-low">
                {lowFitAccounts.toLocaleString()}
              </div>
              <div className="text-lg text-muted-foreground">
                ({lowFitPct}%)
              </div>
            </div>
            {lowFitTrend !== 0 && (
              <div className="flex items-center gap-1 text-xs mt-2">
                <TrendIcon value={lowFitTrend} />
                <span className={cn(
                  "font-medium",
                  lowFitTrend > 0 ? "text-executive-green" : "text-executive-red"
                )}>
                  {lowFitTrend > 0 ? "+" : ""}{lowFitTrend} accounts
                </span>
                {lowFitPercentageTrend !== 0 && (
                  <span className="text-muted-foreground">
                    ({lowFitPercentageTrend > 0 ? "+" : ""}{lowFitPercentageTrend.toFixed(1)}% pts)
                  </span>
                )}
                <span className="text-muted-foreground">vs last week</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Click any category to view filtered accounts
        </p>
      </CardContent>
    </Card>
  );
}
