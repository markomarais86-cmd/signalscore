import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, AlertOctagon, Sparkles, Target, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EnrichmentModal } from "./EnrichmentModal";

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface EnhancedRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  count: number;
  impact: string;
  fix?: {
    label: string;
    action: 'enrich' | 'navigate';
    target?: string;
    fields?: string[];
  };
}

interface EnhancedRisksCardProps {
  risks: EnhancedRisk[];
  campaignReadyCount?: number;
  completenessScore?: number;
  totalScored?: number;
  onRiskClick?: (risk: EnhancedRisk) => void;
}

export function EnhancedRisksCard({ 
  risks, 
  campaignReadyCount = 0,
  completenessScore = 0,
  totalScored = 0,
  onRiskClick 
}: EnhancedRisksCardProps) {
  const navigate = useNavigate();
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false);
  const [enrichmentFields, setEnrichmentFields] = useState<string[]>([]);

  const getSeverityIcon = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon className="h-4 w-4 text-executive-red" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-executive-amber" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critical':
        return 'border-executive-red/40 bg-executive-red/10 hover:bg-executive-red/15';
      case 'high':
        return 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15';
      case 'medium':
        return 'border-executive-amber/40 bg-executive-amber/10 hover:bg-executive-amber/15';
      case 'low':
        return 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/15';
    }
  };

  const getSeverityLabel = (severity: RiskSeverity) => {
    const labels = {
      critical: { text: 'Critical', className: 'bg-executive-red text-white' },
      high: { text: 'High', className: 'bg-orange-500 text-white' },
      medium: { text: 'Medium', className: 'bg-executive-amber text-black' },
      low: { text: 'Low', className: 'bg-blue-500 text-white' }
    };
    return labels[severity];
  };

  const handleFixAction = (risk: EnhancedRisk) => {
    if (!risk.fix) return;

    if (risk.fix.action === 'enrich') {
      setEnrichmentFields(risk.fix.fields || []);
      setEnrichmentModalOpen(true);
    } else if (risk.fix.action === 'navigate' && risk.fix.target) {
      navigate(risk.fix.target);
    }
  };

  // Group risks by severity
  const groupedRisks = {
    critical: risks.filter(r => r.severity === 'critical'),
    high: risks.filter(r => r.severity === 'high'),
    medium: risks.filter(r => r.severity === 'medium'),
    low: risks.filter(r => r.severity === 'low')
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-executive-red" />
          Risks & Recommended Actions
        </CardTitle>
        <CardDescription>
          Prioritized issues with actionable fixes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk Tiles by Severity */}
        {risks.length > 0 ? (
          <div className="space-y-4">
            {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
              const severityRisks = groupedRisks[severity];
              if (severityRisks.length === 0) return null;

              const severityLabel = getSeverityLabel(severity);

              return (
                <div key={severity} className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {getSeverityIcon(severity)}
                    <span className="capitalize">{severity}</span>
                    <Badge variant="outline" className="ml-auto">
                      {severityRisks.length}
                    </Badge>
                  </h3>
                  
                  <div className="space-y-2">
                    {severityRisks.map((risk) => (
                      <div
                        key={risk.id}
                        className={cn(
                          "p-3 rounded-lg border-2 transition-all cursor-pointer",
                          getSeverityColor(risk.severity)
                        )}
                        onClick={() => onRiskClick?.(risk)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">{risk.title}</h4>
                              <Badge className={cn("text-xs", severityLabel.className)}>
                                {severityLabel.text}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {risk.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs">
                              <div>
                                <span className="font-bold text-lg">{risk.count.toLocaleString()}</span>
                                <span className="text-muted-foreground ml-1">affected</span>
                              </div>
                              <div className="text-muted-foreground">
                                Impact: <span className="font-medium text-foreground">{risk.impact}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {risk.fix && (
                          <Button 
                            size="sm" 
                            className="w-full mt-3 h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFixAction(risk);
                            }}
                          >
                            {risk.fix.label} →
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-3 text-executive-green" />
            <p className="text-sm font-medium">All Systems Operational</p>
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
                onClick={() => navigate('/campaign-builder')} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Build Campaign
              </Button>
            )}
            <Button 
              onClick={() => {
                setEnrichmentFields([]);
                setEnrichmentModalOpen(true);
              }}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Enrich Data
            </Button>
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

        <EnrichmentModal
          open={enrichmentModalOpen}
          onOpenChange={setEnrichmentModalOpen}
          targetFields={enrichmentFields}
        />
      </CardContent>
    </Card>
  );
}