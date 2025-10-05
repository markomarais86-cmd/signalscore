import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, Target, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Insight {
  type: string;
  title: string;
  description: string;
  impact: string;
  action?: string;
  route?: string;
}

interface AIRecommendationsTilesProps {
  insights: Insight[];
  onRefresh?: () => void;
}

const getIconForType = (type: string) => {
  switch (type.toLowerCase()) {
    case 'quality':
      return AlertTriangle;
    case 'growth':
      return TrendingUp;
    case 'efficiency':
      return Zap;
    default:
      return Target;
  }
};

const getColorForType = (type: string) => {
  switch (type.toLowerCase()) {
    case 'quality':
      return 'border-executive-amber/40 bg-executive-amber/5 hover:bg-executive-amber/10';
    case 'growth':
      return 'border-executive-green/40 bg-executive-green/5 hover:bg-executive-green/10';
    case 'efficiency':
      return 'border-primary/40 bg-primary/5 hover:bg-primary/10';
    default:
      return 'border-border bg-muted/30 hover:bg-muted/50';
  }
};

export function AIRecommendationsTiles({ insights, onRefresh }: AIRecommendationsTilesProps) {
  const navigate = useNavigate();

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI-Powered Recommendations
          </CardTitle>
          <CardDescription>
            No recommendations available yet - score more accounts to get insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/accounts?action=score')} className="w-full">
            Score Accounts
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>
              Actionable insights based on your data and ICP
            </CardDescription>
          </div>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.slice(0, 6).map((insight, idx) => {
            const Icon = getIconForType(insight.type);
            const colorClass = getColorForType(insight.type);
            
            return (
              <div
                key={idx}
                className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${colorClass}`}
                onClick={() => insight.route && navigate(insight.route)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-background/80">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {insight.type}
                  </Badge>
                </div>
                
                <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                  {insight.title}
                </h4>
                
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {insight.description}
                </p>
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs font-medium text-primary">
                    {insight.impact}
                  </span>
                  {insight.action && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      {insight.action}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
