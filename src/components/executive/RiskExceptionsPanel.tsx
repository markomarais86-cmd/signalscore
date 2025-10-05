import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  impact: string;
}

interface RiskExceptionsPanelProps {
  risks: RiskItem[];
  onRiskClick?: (risk: RiskItem) => void;
}

export function RiskExceptionsPanel({ risks, onRiskClick }: RiskExceptionsPanelProps) {
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
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-executive-amber" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-executive-red/20 bg-executive-red/5';
      case 'warning':
        return 'border-executive-amber/20 bg-executive-amber/5';
      case 'info':
        return 'border-blue-500/20 bg-blue-500/5';
    }
  };

  const getSeverityBadge = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'warning':
        return <Badge className="text-xs bg-executive-amber text-black">Warning</Badge>;
      case 'info':
        return <Badge variant="outline" className="text-xs">Info</Badge>;
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-executive-red" />
          Risks & Exceptions
        </CardTitle>
        <CardDescription>
          Critical issues requiring attention to scale GTM operations
        </CardDescription>
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
