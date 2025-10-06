import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Target, TrendingUp, Database, Sparkles } from "lucide-react";
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
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Scoring Progress */}
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Scoring Progress</h3>
                {scoringTrend !== undefined && scoringTrend !== 0 && <TrendIndicator value={scoringTrend} />}
              </div>
              <div className="text-4xl font-bold text-primary mb-2">{scoringProgress}%</div>
              <Progress value={scoringProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {totalScored.toLocaleString()} of {totalAccounts.toLocaleString()} accounts scored
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> CRM
                </span>
                <span className="font-medium">{crmScored.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> Database
                </span>
                <span className="font-medium">{databaseScored.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              {scoringProgress < 100 && (
                <Button 
                  onClick={() => navigate('/accounts?action=score')} 
                  className="w-full"
                  size="sm"
                >
                  Score Remaining
                </Button>
              )}
              <Button 
                onClick={() => navigate('/accounts?fit=high')} 
                className="w-full"
                size="sm"
                variant="outline"
              >
                View High-Fit Accounts
              </Button>
            </div>
          </div>

          {/* Center: ICP Fit Distribution */}
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">ICP Fit Distribution</h3>
            <div className="space-y-3">
              {fitDistribution.map((item) => (
                <div 
                  key={item.name}
                  onClick={() => {
                    const fitLevel = item.name === 'High Fit' ? 'high' : item.name === 'Medium Fit' ? 'medium' : 'low';
                    navigate(`/accounts?fit=${fitLevel}`);
                  }}
                  className="p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer bg-card"
                  style={{ borderColor: item.color }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">{item.name}</div>
                      <div className="text-2xl font-bold mt-1" style={{ color: item.color }}>
                        {item.value.toLocaleString()}
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-lg font-bold px-3 py-1"
                      style={{ borderColor: item.color, color: item.color }}
                    >
                      {item.percentage}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Data Completeness */}
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Data Completeness</h3>
                {completenessTrend !== undefined && completenessTrend !== 0 && <TrendIndicator value={completenessTrend} />}
              </div>
              <div className={`text-4xl font-bold mb-2 ${getCompletenessColor(completeness)}`}>
                {completeness}%
              </div>
              <Progress value={completeness} className="h-2" />
            </div>

            <div className="space-y-2 pt-4 border-t">
              {[
                { label: 'Industry', value: industryCompleteness },
                { label: 'Size', value: sizeCompleteness },
                { label: 'Revenue', value: revenueCompleteness },
                { label: 'Geography', value: geoCompleteness },
                { label: 'Contacts', value: contactsCompleteness }
              ].map((field) => (
                <div key={field.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className={`font-medium ${getCompletenessColor(field.value)}`}>
                    {field.value}%
                  </span>
                </div>
              ))}
            </div>

            {completeness < 70 && (
              <Button 
                onClick={() => navigate('/settings?tab=integrations&action=enrich')} 
                className="w-full mt-4"
                size="sm"
                variant="outline"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Enrich Data
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
