import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, TrendingDown, Database, Sparkles, AlertCircle } from "lucide-react";
import { TrendIndicator } from "./TrendIndicator";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CombinedScoringICPCardProps {
  scoringProgress: number;
  totalScored: number;
  totalAccounts: number;
  crmScored: number;
  databaseScored: number;
  fitDistribution: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  completeness: number;
  industryCompleteness: number;
  sizeCompleteness: number;
  revenueCompleteness: number;
  geoCompleteness: number;
  scoringTrend?: number;
  completenessTrend?: number;
  fitTrends?: {
    highFitAccounts?: number;
    mediumFitAccounts?: number;
    lowFitAccounts?: number;
    highFitPercentage?: number;
    mediumFitPercentage?: number;
    lowFitPercentage?: number;
  };
}

export function CombinedScoringICPCard({
  scoringProgress,
  totalScored,
  totalAccounts,
  crmScored,
  databaseScored,
  fitDistribution,
  completeness,
  industryCompleteness,
  sizeCompleteness,
  revenueCompleteness,
  geoCompleteness,
  scoringTrend,
  completenessTrend,
  fitTrends
}: CombinedScoringICPCardProps) {
  const navigate = useNavigate();

  const getCompletenessColor = (value: number) => {
    if (value >= 80) return "text-executive-green";
    if (value >= 60) return "text-executive-amber";
    return "text-executive-red";
  };

  const getFitIcon = (name: string) => {
    if (name === 'High Fit') return Target;
    if (name === 'Medium Fit') return TrendingUp;
    return AlertCircle;
  };

  const getFitBadgeClass = (name: string) => {
    if (name === 'High Fit') return "border-fit-high text-fit-high hover:bg-fit-high hover:text-fit-high-foreground";
    if (name === 'Medium Fit') return "border-fit-medium text-fit-medium hover:bg-fit-medium hover:text-fit-medium-foreground";
    return "border-fit-low text-fit-low hover:bg-fit-low hover:text-fit-low-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Scoring & ICP Performance
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Account quality, ICP fit distribution, and data completeness
          <Badge variant="outline" className="text-xs">
            <Database className="h-3 w-3 mr-1" />
            Your Database
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compact ICP Fit Summary - Full details in hero section above */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-muted-foreground">ICP Fit:</span>
          <div className="flex gap-2 flex-wrap">
            {fitDistribution.map((item) => (
              <Badge 
                key={item.name}
                variant="outline"
                className={cn("cursor-pointer transition-colors border-2 font-semibold", getFitBadgeClass(item.name))}
                onClick={() => {
                  const fitLevel = item.name === 'High Fit' ? 'high' : item.name === 'Medium Fit' ? 'medium' : 'low';
                  navigate(`/accounts?fit=${fitLevel}`);
                }}
              >
                {item.name}: {item.value.toLocaleString()} ({item.percentage}%)
              </Badge>
            ))}
          </div>
        </div>

        {/* Supporting Metrics: Scoring & Completeness */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Scoring Progress - Compact */}
          <Card className="border-2">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Scoring Progress</h3>
                {scoringTrend !== undefined && scoringTrend !== 0 && <TrendIndicator value={scoringTrend} />}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="hsl(var(--secondary))"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="hsl(var(--primary))"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - scoringProgress / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{scoringProgress}%</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {totalScored.toLocaleString()} of {totalAccounts.toLocaleString()} accounts scored
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Database className="h-3 w-3" /> CRM
                      </span>
                      <span className="font-medium">{crmScored.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Database className="h-3 w-3" /> Database
                      </span>
                      <span className="font-medium">{databaseScored.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {scoringProgress < 100 && (
                  <Button 
                    onClick={() => navigate('/accounts?action=score')} 
                    className="flex-1"
                    size="sm"
                  >
                    Score Remaining
                  </Button>
                )}
                <Button 
                  onClick={() => navigate('/accounts?fit=high')} 
                  className="flex-1"
                  size="sm"
                  variant="outline"
                >
                  View High-Fit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Completeness - Compact */}
          <Card className="border-2">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Data Completeness</h3>
                {completenessTrend !== undefined && completenessTrend !== 0 && <TrendIndicator value={completenessTrend} />}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="hsl(var(--secondary))"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke={completeness >= 80 ? "hsl(var(--executive-green))" : completeness >= 60 ? "hsl(var(--executive-amber))" : "hsl(var(--executive-red))"}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - completeness / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-bold ${getCompletenessColor(completeness)}`}>
                      {completeness}%
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-1">
                  {[
                    { label: 'Industry', value: industryCompleteness },
                    { label: 'Size', value: sizeCompleteness },
                    { label: 'Revenue', value: revenueCompleteness },
                    { label: 'Geography', value: geoCompleteness }
                  ].map((field) => (
                    <div key={field.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{field.label}</span>
                      <span className={`font-medium ${getCompletenessColor(field.value)}`}>
                        {field.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {completeness < 70 && (
                <Button 
                  onClick={() => navigate('/settings?tab=integrations&action=enrich')} 
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich Data
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
