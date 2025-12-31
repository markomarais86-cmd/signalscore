import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, ChevronDown, Database, Brain, TrendingUp } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { useState } from "react";

interface EnrichmentSourceViewerProps {
  account: {
    enriched_from?: string;
    enriched_at?: string;
    enrichment_phase?: string;
    enrichment_confidence?: number;
    enrichment_citations?: Array<{ url: string; supports: string }>;
    tech_stack?: string[];
    trust_signals?: {
      soc2?: boolean;
      iso27001?: boolean;
      gdpr_page?: boolean;
    };
    last_funding_round?: string;
    total_raised_usd?: number;
  };
}

export function EnrichmentSourceViewer({ account }: EnrichmentSourceViewerProps) {
  const [citationsOpen, setCitationsOpen] = useState(false);

  if (!account.enriched_from) {
    return null;
  }

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'pdl':
        return <Database className="h-4 w-4" />;
      case 'clearbit':
        return <TrendingUp className="h-4 w-4" />;
      case 'ai':
        return <Brain className="h-4 w-4" />;
      case 'deep_research':
        return <LaunchPulseMark className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'pdl':
        return 'People Data Labs';
      case 'clearbit':
        return 'Clearbit Free';
      case 'ai':
        return 'AI Estimation';
      case 'deep_research':
        return 'Deep Research';
      default:
        return phase;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return { variant: 'default' as const, label: 'High Confidence' };
    if (confidence >= 0.6) return { variant: 'outline' as const, label: 'Medium Confidence' };
    return { variant: 'secondary' as const, label: 'Low Confidence' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getPhaseIcon(account.enrichment_phase || account.enriched_from)}
            Data Source
          </div>
          {account.enrichment_confidence && (
            <Badge variant={getConfidenceBadge(account.enrichment_confidence).variant}>
              {getConfidenceBadge(account.enrichment_confidence).label} ({Math.round(account.enrichment_confidence * 100)}%)
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Enriched from {getPhaseLabel(account.enrichment_phase || account.enriched_from)}
          {account.enriched_at && ` on ${new Date(account.enriched_at).toLocaleDateString()}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deep Research Extras */}
        {account.enrichment_phase === 'deep_research' && (
          <div className="space-y-3">
            {account.tech_stack && account.tech_stack.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Tech Stack</p>
                <div className="flex flex-wrap gap-1">
                  {account.tech_stack.map((tech) => (
                    <Badge key={tech} variant="outline" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {account.trust_signals && (
              <div>
                <p className="text-sm font-medium mb-2">Trust Signals</p>
                <div className="flex flex-wrap gap-2">
                  {account.trust_signals.soc2 && <Badge variant="default">SOC 2</Badge>}
                  {account.trust_signals.iso27001 && <Badge variant="default">ISO 27001</Badge>}
                  {account.trust_signals.gdpr_page && <Badge variant="default">GDPR</Badge>}
                </div>
              </div>
            )}

            {account.last_funding_round && (
              <div>
                <p className="text-sm font-medium mb-1">Funding</p>
                <p className="text-sm text-muted-foreground">
                  {account.last_funding_round}
                  {account.total_raised_usd && ` • $${(account.total_raised_usd / 1000000).toFixed(1)}M raised`}
                </p>
              </div>
            )}

            {account.enrichment_citations && account.enrichment_citations.length > 0 && (
              <Collapsible open={citationsOpen} onOpenChange={setCitationsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm font-medium">
                      View Sources ({account.enrichment_citations.length})
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${citationsOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {account.enrichment_citations.map((citation, idx) => (
                    <div key={idx} className="p-2 border rounded-lg bg-muted/30 text-sm">
                      <p className="font-medium mb-1">{citation.supports}</p>
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {new URL(citation.url).hostname}
                      </a>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Standard Enrichment Info */}
        {account.enrichment_phase !== 'deep_research' && (
          <p className="text-sm text-muted-foreground">
            This account was enriched using {getPhaseLabel(account.enrichment_phase || account.enriched_from)}, 
            providing basic firmographic data (industry, size, revenue, location).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
