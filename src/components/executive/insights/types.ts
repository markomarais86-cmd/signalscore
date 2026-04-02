import { RiskItem, RiskSeverity } from "@/utils/risk-detector";
import { Insight } from "../UnifiedInsightsPanel";

export interface EnrichmentProgress {
  jobId: string;
  status: string;
  processed: number;
  total: number;
  enriched: number;
  lastProgressUpdate?: string;
  isStalled?: boolean;
}

export type UnifiedItem = {
  id: string;
  type: 'risk' | 'insight';
  priority: number;
  severity?: RiskSeverity;
  category?: string;
  title: string;
  description: string;
  impact: string;
  count?: number;
  action?: string;
  route?: string;
  filter?: Record<string, any>;
  relatedRisk?: string;
  source: RiskItem | Insight;
};
