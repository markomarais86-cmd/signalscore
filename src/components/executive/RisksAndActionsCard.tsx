import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Target, Download, Settings } from "lucide-react";
import { LaunchPulseMark } from '@/components/BrandLogo';
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface RiskItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  impact: string;
  action?: {
    label: string;
    route: string;
  };
}

interface RisksAndActionsCardProps {
  risks: RiskItem[];
  campaignReadyCount?: number;
  completenessScore?: number;
  totalScored?: number;
  onRiskClick?: (risk: RiskItem) => void;
}

export function RisksAndActionsCard({ 
  risks, 
  campaignReadyCount = 0,
  completenessScore = 0,
  totalScored = 0,
  onRiskClick 
}: RisksAndActionsCardProps) {
  const navigate = useNavigate();

  const getSeverityIcon = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-executive-red" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-executive-amber" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: RiskItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-executive-red/30 bg-executive-red/5';
      case 'warning':
        return 'border-executive-amber/30 bg-executive-amber/5';
      case 'info':
        return 'border-blue-500/30 bg-blue-500/5';
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

  const criticalRisks = risks.filter(r => r.severity === 'critical');
  const warningRisks = risks.filter(r => r.severity === 'warning');
  const infoRisks = risks.filter(r => r.severity === 'info');

  const handleEnrichClick = (targetFields?: string[]) => {
    // Navigate to enrichment page with target fields
    const fieldsParam = targetFields?.join(',') || '';
    navigate(`/enrichment?mode=existing&type=accounts${fieldsParam ? `&fields=${fieldsParam}` : ''}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-executive-red" />
          Risks & Recommended Actions
        </CardTitle>
        <CardDescription>
          Issues requiring attention and suggested next steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Tiles by Severity */}
        {risks.length > 0 ? (
          <>
            {criticalRisks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-executive-red flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Issues ({criticalRisks.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {criticalRisks.map((risk) => (
                    <div
                      key={risk.id}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md",
                        getSeverityColor(risk.severity)
                      )}
                      onClick={() => onRiskClick?.(risk)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {getSeverityIcon(risk.severity)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-1">{risk.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {risk.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold">{risk.count.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">affected</div>
                        </div>
                      </div>
                      {risk.action && (
                        <Button 
                          size="sm" 
                          className="w-full mt-2 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (risk.action!.route.includes('enrich')) {
                              handleEnrichClick(['contacts']);
                            } else {
                              navigate(risk.action!.route);
                            }
                          }}
                        >
                          {risk.action.label}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {warningRisks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-executive-amber flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Warnings ({warningRisks.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {warningRisks.map((risk) => (
                    <div
                      key={risk.id}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md",
                        getSeverityColor(risk.severity)
                      )}
                      onClick={() => onRiskClick?.(risk)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {getSeverityIcon(risk.severity)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-1">{risk.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {risk.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold">{risk.count.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">affected</div>
                        </div>
                      </div>
                      {risk.action && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full mt-2 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (risk.action!.route.includes('enrich')) {
                              handleEnrichClick();
                            } else {
                              navigate(risk.action!.route);
                            }
                          }}
                        >
                          {risk.action.label}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 text-executive-green" />
            <p className="text-sm font-medium">All systems operational</p>
            <p className="text-xs mt-1">Data quality and coverage meet targets</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {totalScored === 0 && (
              <Button 
                onClick={() => navigate('/icp-manager')} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <Target className="h-4 w-4 mr-2" />
                Define ICP
              </Button>
            )}
            {campaignReadyCount > 0 && (
              <Button 
                onClick={() => navigate('/accounts?campaign_ready=true')} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <LaunchPulseMark className="h-4 w-4 mr-2" />
                View Campaign-Ready Accounts
              </Button>
            )}
            {completenessScore < 70 && (
              <Button 
                onClick={() => handleEnrichClick()} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <LaunchPulseMark className="h-4 w-4 mr-2" />
                Enrich Data
              </Button>
            )}
            <Button 
              onClick={() => navigate('/data-upload')} 
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>
        </div>

        {/* Enrichment modal removed - consolidated into Enrichment page */}
      </CardContent>
    </Card>
  );
}
