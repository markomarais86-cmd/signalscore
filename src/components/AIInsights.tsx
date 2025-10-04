import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Target, Lightbulb } from "lucide-react";
import { useState } from "react";
import { InsightDetailModal } from "@/components/insights/InsightDetailModal";

interface AIInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'recommendation' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  actionable: boolean;
  relatedSegments: string[];
}

interface AIInsightsProps {
  insights: AIInsight[];
  onApplyRecommendation?: (insightId: string) => void;
}

export function AIInsights({ insights, onApplyRecommendation }: AIInsightsProps) {
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-[hsl(var(--signal-low))]" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4 text-[hsl(var(--signal-medium))]" />;
      case 'trend': return <TrendingDown className="h-4 w-4 text-muted-foreground" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-[hsl(var(--signal-low))]';
      case 'medium': return 'bg-[hsl(var(--signal-medium))]';
      case 'low': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'opportunity': return 'text-[hsl(var(--signal-high))] bg-[hsl(var(--signal-high))]/10';
      case 'warning': return 'text-[hsl(var(--signal-low))] bg-[hsl(var(--signal-low))]/10';
      case 'recommendation': return 'text-[hsl(var(--signal-medium))] bg-[hsl(var(--signal-medium))]/10';
      case 'trend': return 'text-muted-foreground bg-muted/50';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const sortedInsights = [...insights].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[hsl(var(--primary))]" />
          AI-Powered ICP Insights
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Automated recommendations based on CRM + enrichment data analysis
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedInsights.map((insight) => (
            <div 
              key={insight.id} 
              className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedInsight(insight)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <Badge 
                        className={`text-white text-xs ${getPriorityColor(insight.priority)}`}
                      >
                        {insight.priority.toUpperCase()}
                      </Badge>
                      <Badge 
                        variant="secondary"
                        className={`text-xs ${getTypeColor(insight.type)}`}
                      >
                        {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span className="text-muted-foreground">Impact:</span>
                        <span className="font-medium">{insight.impact}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="font-medium ml-1">{insight.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                {insight.actionable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplyRecommendation?.(insight.id)}
                    className="ml-3"
                  >
                    Apply
                  </Button>
                )}
              </div>
              
              {insight.relatedSegments.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Related segments:</span>
                  <div className="flex flex-wrap gap-1">
                    {insight.relatedSegments.map((segment, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {segment}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <InsightDetailModal
          insight={selectedInsight}
          isOpen={selectedInsight !== null}
          onClose={() => setSelectedInsight(null)}
        />
      </CardContent>
    </Card>
  );
}