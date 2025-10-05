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

            {scoringProgress < 100 && (
              <Button 
                onClick={() => navigate('/accounts?action=score')} 
                className="w-full mt-4"
                size="sm"
              >
                Score Remaining
              </Button>
            )}
          </div>

          {/* Center: ICP Fit Distribution */}
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">ICP Fit Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={fitDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickFormatter={(value) => value.split(' ')[0]}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-sm">{data.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.value.toLocaleString()} accounts ({data.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {fitDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {fitDistribution.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="text-lg font-bold" style={{ color: item.color }}>
                    {item.value.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.percentage}%
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
