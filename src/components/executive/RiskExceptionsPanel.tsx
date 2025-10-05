import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { RiskItem } from "@/utils/risk-detector";

interface RiskExceptionsPanelProps {
  risks: RiskItem[];
  onRiskClick?: (risk: RiskItem) => void;
}

export function RiskExceptionsPanel({ risks, onRiskClick }: RiskExceptionsPanelProps) {
  const navigate = useNavigate();
  
  if (risks.length === 0) {
    return (
      <Card className="col-span-full border-executive-green/20 bg-executive-green/5">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Info className="h-5 w-5 text-executive-green" />
            System Health
          </CardTitle>
          <CardDescription>No critical issues detected</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All systems operational. Data quality and coverage meet targets.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-executive-red" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-executive-amber" />;
      case 'low':
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-executive-red/20 bg-executive-red/5';
      case 'high':
        return 'border-orange-500/20 bg-orange-500/5';
      case 'medium':
        return 'border-executive-amber/20 bg-executive-amber/5';
      case 'low':
        return 'border-blue-500/20 bg-blue-500/5';
    }
  };

  const getSeverityBadge = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'high':
        return <Badge className="text-xs bg-orange-500 text-white">High</Badge>;
      case 'medium':
        return <Badge className="text-xs bg-executive-amber text-black">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-xs">Low</Badge>;
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-executive-red" />
              Risks & Exceptions
            </CardTitle>
            <CardDescription>
              Critical issues requiring attention to scale GTM operations
            </CardDescription>
          </div>
          <Button
            onClick={() => navigate('/settings?tab=integrations')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Enrich Missing Data
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {risks.map((risk) => (
            <div
              key={risk.id}
              className={cn(
                "p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md",
                getSeverityColor(risk.severity)
              )}
              onClick={() => onRiskClick?.(risk)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {getSeverityIcon(risk.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{risk.title}</h4>
                      {getSeverityBadge(risk.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {risk.description}
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      Impact: {risk.impact}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-foreground">
                    {risk.count.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    affected
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
