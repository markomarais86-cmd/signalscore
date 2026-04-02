import { Button } from "@/components/ui/button";
import { Target, Sparkles, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EnrichmentProgress } from "./types";

interface QuickActionsProps {
  totalScored: number;
  campaignReadyCount: number;
  isStartingEnrichment: boolean;
  enrichmentProgress: EnrichmentProgress | null;
  onEnrichAction: (action: string, params?: Record<string, unknown>) => void;
}

export function QuickActions({ totalScored, campaignReadyCount, isStartingEnrichment, enrichmentProgress, onEnrichAction }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="pt-4 border-t">
      <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {totalScored === 0 && (
          <Button onClick={() => navigate('/icp-manager')} variant="outline" size="sm" className="justify-start">
            <Target className="h-4 w-4 mr-2" />
            Define ICP
          </Button>
        )}
        {campaignReadyCount > 0 && (
          <Button onClick={() => navigate('/accounts?campaign_ready=true')} variant="outline" size="sm" className="justify-start">
            <Sparkles className="h-4 w-4 mr-2" />
            {campaignReadyCount} Campaign-Ready
          </Button>
        )}
        <Button
          onClick={() => onEnrichAction('enrich_ai_free')}
          variant="outline"
          size="sm"
          className="justify-start"
          disabled={isStartingEnrichment || (enrichmentProgress !== null && ['pending', 'processing'].includes(enrichmentProgress.status))}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {enrichmentProgress ? 'Enriching...' : 'Enrich Data'}
        </Button>
        <Button onClick={() => navigate('/data-upload')} variant="outline" size="sm" className="justify-start">
          <Download className="h-4 w-4 mr-2" />
          Upload Data
        </Button>
      </div>
    </div>
  );
}
