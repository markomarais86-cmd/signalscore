import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Flag,
  TrendingUp,
  BarChart3,
  Eye
} from "lucide-react";

interface EnrichedAccount {
  id: string;
  name: string;
  enrichment_confidence?: number;
  enriched_from?: string;
  enrichment_field_scores?: Record<string, number>;
  enrichment_citations?: string[];
  employee_count?: number;
  revenue_range?: string;
  industry_norm?: string;
  city?: string;
  country?: string;
  linkedin_url?: string;
}

interface DataQualityReportProps {
  accounts: EnrichedAccount[];
  onReviewAccount?: (accountId: string) => void;
}

export function DataQualityReport({ accounts, onReviewAccount }: DataQualityReportProps) {
  // Calculate quality metrics
  const totalRecords = accounts.length;
  
  const highConfidence = accounts.filter(a => (a.enrichment_confidence || 0) >= 80).length;
  const mediumConfidence = accounts.filter(a => {
    const conf = a.enrichment_confidence || 0;
    return conf >= 50 && conf < 80;
  }).length;
  const lowConfidence = accounts.filter(a => {
    const conf = a.enrichment_confidence || 0;
    return conf > 0 && conf < 50;
  }).length;
  const noData = accounts.filter(a => !a.enrichment_confidence || a.enrichment_confidence === 0).length;
  
  // Source breakdown
  const sourceBreakdown = accounts.reduce((acc, account) => {
    const source = account.enriched_from || 'unknown';
    if (source === 'verified_multi_source') {
      acc.verified = (acc.verified || 0) + 1;
    } else if (source === 'perplexity' || source === 'firecrawl-website') {
      acc.webSearch = (acc.webSearch || 0) + 1;
    } else if (source === 'launch_pulse' || source === 'ai_fallback') {
      acc.aiEstimated = (acc.aiEstimated || 0) + 1;
    } else if (source !== 'unknown') {
      acc.other = (acc.other || 0) + 1;
    }
    return acc;
  }, { verified: 0, webSearch: 0, aiEstimated: 0, other: 0 });
  
  // Field coverage
  const fieldCoverage = {
    employee_count: accounts.filter(a => a.employee_count).length,
    revenue_range: accounts.filter(a => a.revenue_range).length,
    industry: accounts.filter(a => a.industry_norm).length,
    location: accounts.filter(a => a.city || a.country).length,
    linkedin: accounts.filter(a => a.linkedin_url).length,
  };
  
  // Records needing review (low confidence or missing critical data)
  const needsReview = accounts.filter(a => 
    (a.enrichment_confidence && a.enrichment_confidence < 60) ||
    (!a.employee_count && !a.revenue_range)
  );
  
  const confidencePercent = (count: number) => totalRecords > 0 
    ? Math.round((count / totalRecords) * 100) 
    : 0;
  
  const coveragePercent = (count: number) => totalRecords > 0 
    ? Math.round((count / totalRecords) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Confidence Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Confidence Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual bars */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">High (80%+)</span>
              </div>
              <div className="flex-1">
                <Progress value={confidencePercent(highConfidence)} className="h-3 [&>div]:bg-green-500" />
              </div>
              <span className="text-sm font-medium w-16 text-right">
                {highConfidence} ({confidencePercent(highConfidence)}%)
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Med (50-79%)</span>
              </div>
              <div className="flex-1">
                <Progress value={confidencePercent(mediumConfidence)} className="h-3 [&>div]:bg-blue-500" />
              </div>
              <span className="text-sm font-medium w-16 text-right">
                {mediumConfidence} ({confidencePercent(mediumConfidence)}%)
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm">Low (&lt;50%)</span>
              </div>
              <div className="flex-1">
                <Progress value={confidencePercent(lowConfidence)} className="h-3 [&>div]:bg-amber-500" />
              </div>
              <span className="text-sm font-medium w-16 text-right">
                {lowConfidence} ({confidencePercent(lowConfidence)}%)
              </span>
            </div>
            
            {noData > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-28 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">No Data</span>
                </div>
                <div className="flex-1">
                  <Progress value={confidencePercent(noData)} className="h-3 [&>div]:bg-gray-300" />
                </div>
                <span className="text-sm font-medium w-16 text-right text-muted-foreground">
                  {noData} ({confidencePercent(noData)}%)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Source Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-700">{sourceBreakdown.verified}</p>
              <p className="text-xs text-green-600">Verified Multi-Source</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-2xl font-bold text-blue-700">{sourceBreakdown.webSearch}</p>
              <p className="text-xs text-blue-600">Web Search</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-2xl font-bold text-amber-700">{sourceBreakdown.aiEstimated}</p>
              <p className="text-xs text-amber-600">AI Estimated</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-2xl font-bold text-gray-700">{sourceBreakdown.other + (totalRecords - sourceBreakdown.verified - sourceBreakdown.webSearch - sourceBreakdown.aiEstimated)}</p>
              <p className="text-xs text-gray-600">Other / Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Field Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(fieldCoverage).map(([field, count]) => {
              const pct = coveragePercent(count);
              const label = field.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={field} className="text-center p-2 rounded-lg border">
                  <p className="text-lg font-semibold">{pct}%</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">({count}/{totalRecords})</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Review Queue */}
      {needsReview.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-600" />
              Needs Review ({needsReview.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {needsReview.slice(0, 10).map((account) => (
                <div 
                  key={account.id} 
                  className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="outline" 
                      className="text-xs text-amber-600 border-amber-300"
                    >
                      {account.enrichment_confidence || 0}%
                    </Badge>
                    <span className="font-medium text-sm">{account.name || 'Unknown'}</span>
                  </div>
                  {onReviewAccount && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReviewAccount(account.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {needsReview.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{needsReview.length - 10} more accounts need review
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
