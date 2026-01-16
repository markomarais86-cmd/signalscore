import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  TrendingDown, 
  Zap,
  Database,
  Globe,
  Sparkles
} from "lucide-react";

interface CostBreakdown {
  firecrawl: number;
  perplexity: number;
  ai_fallback: number;
  total: number;
}

interface EnrichmentCostTrackerProps {
  totalRecords: number;
  enrichedRecords: number;
  costBreakdown?: CostBreakdown;
  isProcessing?: boolean;
  fieldsEnriched?: number;
}

// Cost estimates per provider (approximate)
const COST_ESTIMATES = {
  firecrawl: 0.005,     // $0.005 per scrape
  perplexity: 0.005,    // $0.005 per search
  ai_fallback: 0.001,   // $0.001 for AI-only
  verified: 0.01,       // $0.01 for multi-source verified
};

export function EnrichmentCostTracker({
  totalRecords,
  enrichedRecords,
  costBreakdown,
  isProcessing = false,
  fieldsEnriched = 0,
}: EnrichmentCostTrackerProps) {
  // Calculate costs
  const estimatedCost = costBreakdown?.total || (enrichedRecords * COST_ESTIMATES.verified);
  const costPerRecord = enrichedRecords > 0 ? estimatedCost / enrichedRecords : 0;
  const costPerField = fieldsEnriched > 0 ? estimatedCost / fieldsEnriched : 0;
  
  // Break down by source (use provided or estimate)
  const breakdown = costBreakdown || {
    firecrawl: enrichedRecords * COST_ESTIMATES.firecrawl * 0.4,
    perplexity: enrichedRecords * COST_ESTIMATES.perplexity * 0.5,
    ai_fallback: enrichedRecords * COST_ESTIMATES.ai_fallback * 0.1,
    total: estimatedCost
  };
  
  const formatCost = (cost: number) => {
    if (cost < 0.01) return `${(cost * 100).toFixed(2)}¢`;
    if (cost < 1) return `${Math.round(cost * 100)}¢`;
    return `$${cost.toFixed(2)}`;
  };

  const progressPercent = totalRecords > 0 
    ? Math.round((enrichedRecords / totalRecords) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Cost Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Enrichment Cost
            {isProcessing && (
              <Badge variant="outline" className="ml-2 animate-pulse">
                Processing...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total cost */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Cost</span>
            <span className="text-2xl font-bold text-primary">
              {formatCost(estimatedCost)}
            </span>
          </div>
          
          {/* Progress if processing */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{enrichedRecords} of {totalRecords} records</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Cost metrics */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-semibold">{formatCost(costPerRecord)}</p>
              <p className="text-xs text-muted-foreground">Cost per Record</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-semibold">{formatCost(costPerField)}</p>
              <p className="text-xs text-muted-foreground">Cost per Field</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown by Source */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Cost by Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Firecrawl */}
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-600" />
              <span className="text-sm">Firecrawl (Website Scraping)</span>
            </div>
            <span className="font-medium">{formatCost(breakdown.firecrawl)}</span>
          </div>
          
          {/* Perplexity */}
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Perplexity (Web Search)</span>
            </div>
            <span className="font-medium">{formatCost(breakdown.perplexity)}</span>
          </div>
          
          {/* AI Fallback */}
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm">AI Estimation (Fallback)</span>
            </div>
            <span className="font-medium">{formatCost(breakdown.ai_fallback)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Efficiency Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-green-50 border border-green-200">
              <p className="text-lg font-bold text-green-700">{enrichedRecords}</p>
              <p className="text-xs text-green-600">Records Enriched</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-lg font-bold text-blue-700">{fieldsEnriched}</p>
              <p className="text-xs text-blue-600">Fields Added</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-lg font-bold text-purple-700">
                {enrichedRecords > 0 ? (fieldsEnriched / enrichedRecords).toFixed(1) : 0}
              </p>
              <p className="text-xs text-purple-600">Fields/Record</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison to Market Rates */}
      <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
        <span className="font-medium">Market comparison:</span> Traditional data providers charge $0.10-0.50 per record.
        <br />
        Your cost: <span className="text-green-600 font-medium">{formatCost(costPerRecord)}/record</span>
        {costPerRecord > 0 && costPerRecord < 0.05 && (
          <span className="text-green-600"> — Saving up to 90% vs traditional providers!</span>
        )}
      </div>
    </div>
  );
}
