import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, Database, Sparkles, AlertCircle } from "lucide-react";
import { TrendIndicator } from "./TrendIndicator";
import { useNavigate } from "react-router-dom";

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
  contactsCompleteness: number;
  scoringTrend?: number;
  completenessTrend?: number;
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
  contactsCompleteness,
  scoringTrend,
  completenessTrend
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Scoring & ICP Performance
        </CardTitle>
        <CardDescription>
          Account quality, ICP fit distribution, and data completeness
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hero Section: ICP Fit Distribution */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">ICP Fit Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fitDistribution.map((item) => {
              const FitIcon = getFitIcon(item.name);
              return (
                <div
                  key={item.name}
                  onClick={() => {
                    const fitLevel = item.name === 'High Fit' ? 'high' : item.name === 'Medium Fit' ? 'medium' : 'low';
                    navigate(`/accounts?fit=${fitLevel}`);
                  }}
                  className="group relative p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer overflow-hidden"
                  style={{ borderColor: item.color }}
                >
                  {/* Gradient Background */}
                  <div 
                    className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
                    style={{ 
                      background: `linear-gradient(135deg, ${item.color}20, ${item.color}05)` 
                    }}
                  />
                  
                  {/* Content */}
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between">
                      <FitIcon className="h-6 w-6" style={{ color: item.color }} />
                      <Badge 
                        variant="outline" 
                        className="text-xl font-bold px-3 py-1.5"
                        style={{ borderColor: item.color, color: item.color }}
                      >
                        {item.percentage}%
                      </Badge>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        {item.name}
                      </div>
                      <div className="text-5xl font-bold tracking-tight" style={{ color: item.color }}>
                        {item.value.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        accounts
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
                    { label: 'Geography', value: geoCompleteness },
                    { label: 'Contacts', value: contactsCompleteness }
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
