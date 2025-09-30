import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, Brain, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CorrelationData {
  correlations: {
    [key: string]: {
      coefficient: number;
      p_value: number;
      weight: number;
      strength: 'weak' | 'moderate' | 'strong';
      significant: boolean;
    };
  };
  recommendations: string[];
  top_predictors: string[];
  weak_predictors: string[];
  model_accuracy: number;
  accounts_analyzed: number;
  closed_won_count: number;
  win_rate: number;
}

export function CorrelationInsights() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);

  const runCorrelationAnalysis = async () => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not loaded",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      console.log('Running correlation analysis...');
      
      const { data, error } = await supabase.functions.invoke('analyze-correlations', {
        body: { org_id: userProfile.org_id }
      });

      if (error) throw error;

      if (data.success) {
        setCorrelationData(data);
        toast({
          title: "Analysis Complete!",
          description: `Analyzed ${data.accounts_analyzed} accounts (${data.closed_won_count} closed won) with ${Math.round(data.model_accuracy * 100)}% accuracy`
        });
      } else {
        throw new Error(data.error || 'Analysis failed');
      }

    } catch (error: any) {
      console.error('Correlation analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze correlations",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'hsl(var(--signal-high))';
      case 'moderate': return 'hsl(var(--signal-medium))';
      case 'weak': return 'hsl(var(--signal-low))';
      default: return 'hsl(var(--muted))';
    }
  };

  const getStrengthBadge = (strength: string, significant: boolean) => {
    const colors = {
      strong: 'bg-[hsl(var(--signal-high))]',
      moderate: 'bg-[hsl(var(--signal-medium))]',
      weak: 'bg-[hsl(var(--signal-low))]'
    };
    return (
      <div className="flex gap-1">
        <Badge className={colors[strength as keyof typeof colors]}>{strength.toUpperCase()}</Badge>
        {significant && <Badge variant="outline" className="text-xs">p&lt;0.05</Badge>}
      </div>
    );
  };

  const chartData = correlationData ? Object.entries(correlationData.correlations).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    weight: value.weight,
    coefficient: Math.round(value.coefficient * 100),
    strength: value.strength
  })) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI-Powered Correlation Analysis
        </CardTitle>
        <CardDescription>
          Discover which ICP criteria actually predict success using statistical correlation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!correlationData && !isAnalyzing && (
            <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              This analysis uses statistical correlation (R and P values) to identify which ICP factors 
              actually predict <strong>closed won deals</strong>. It will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Calculate R (correlation coefficient) and P-values for each criterion</li>
                <li>Identify statistically significant predictors (p &lt; 0.05)</li>
                <li>Assign weights based on actual win rates</li>
                <li>Provide data-driven recommendations</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isAnalyzing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 animate-pulse text-primary" />
              <span className="text-sm text-muted-foreground">AI analyzing your data patterns...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {correlationData && (
          <div className="space-y-6">
            {/* Statistical Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Win Rate</span>
                  <Badge className="bg-primary">{(correlationData.win_rate * 100).toFixed(1)}%</Badge>
                </div>
                <Progress value={correlationData.win_rate * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {correlationData.closed_won_count} closed won / {correlationData.accounts_analyzed} total
                </p>
              </div>
              
              <div className="p-4 border rounded-lg bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Model Accuracy</span>
                  <Badge className="bg-primary">{Math.round(correlationData.model_accuracy * 100)}%</Badge>
                </div>
                <Progress value={correlationData.model_accuracy * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Based on statistical correlations
                </p>
              </div>
            </div>

            {/* Correlation Weights Chart */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Predictive Weights (by correlation strength)
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm">Weight: {data.weight}%</p>
                          <p className="text-sm">Correlation: {data.coefficient}%</p>
                          <p className="text-sm">Strength: {data.strength}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="weight" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getStrengthColor(entry.strength)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Correlations */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Statistical Correlation Analysis</h4>
              {Object.entries(correlationData.correlations).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">{key.replace('_', ' ')}</span>
                      {getStrengthBadge(value.strength, value.significant)}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>R: {value.coefficient.toFixed(3)}</span>
                      <span>P: {value.p_value.toFixed(3)}</span>
                      <span>Weight: {value.weight}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top & Weak Predictors */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-[hsl(var(--signal-high))]/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />
                  <span className="font-semibold text-sm">Top Predictors</span>
                </div>
                <ul className="space-y-1">
                  {correlationData.top_predictors.map((pred, i) => (
                    <li key={i} className="text-sm capitalize">{pred.replace('_', ' ')}</li>
                  ))}
                </ul>
              </div>

              {correlationData.weak_predictors.length > 0 && (
                <div className="p-4 border rounded-lg bg-[hsl(var(--signal-low))]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--signal-low))]" />
                    <span className="font-semibold text-sm">Weak Predictors</span>
                  </div>
                  <ul className="space-y-1">
                    {correlationData.weak_predictors.map((pred, i) => (
                      <li key={i} className="text-sm capitalize">{pred.replace('_', ' ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Recommendations
              </h4>
              <div className="space-y-2">
                {correlationData.recommendations.map((rec, i) => (
                  <Alert key={i}>
                    <AlertDescription>{rec}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={runCorrelationAnalysis}
          disabled={isAnalyzing}
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Brain className="h-4 w-4 mr-2 animate-pulse" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              {correlationData ? 'Re-run Analysis' : 'Start Correlation Analysis'}
            </>
          )}
        </Button>

        {correlationData && (
          <p className="text-xs text-muted-foreground text-center">
            Analysis completed. Scoring engine now uses R and P value-based weights from closed won deals.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
