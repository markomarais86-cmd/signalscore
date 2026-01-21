import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, BarChart3, Loader2, TrendingUp, Zap } from "lucide-react";
import { MarketIntelligencePreview } from "../MarketIntelligencePreview";
import { formatNumber } from "@/utils/format-numbers";
import { LaunchPulseMark } from "@/components/BrandLogo";

interface ROIEstimate {
  estimatedROI: number;
  projectedMeetings: number;
  projectedDeals: number;
  projectedRevenue: number;
}

interface PreviewStepProps {
  dataSource: 'all' | 'crm' | 'database';
  fitScoreMin: number;
  fitScoreMax: number;
  previewData: any[] | null;
  apolloTamData: any;
  isLoadingPreview: boolean;
  loadingProgress: string | null;
  estimatedLeads: number;
  roiEstimate: ROIEstimate | null;
  isEstimatingROI: boolean;
  duplicateEmails: Set<string>;
  excludeDuplicates: boolean;
  setExcludeDuplicates: (value: boolean) => void;
  onEstimateROI: () => void;
  scoreBandBreakdown: { A: number; B: number; C: number };
}

export function PreviewStep({
  dataSource,
  fitScoreMin,
  fitScoreMax,
  previewData,
  apolloTamData,
  isLoadingPreview,
  loadingProgress,
  estimatedLeads,
  roiEstimate,
  isEstimatingROI,
  duplicateEmails,
  excludeDuplicates,
  setExcludeDuplicates,
  onEstimateROI,
  scoreBandBreakdown
}: PreviewStepProps) {
  if (isLoadingPreview) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading campaign preview...</p>
        {loadingProgress && (
          <div className="mt-4 w-full max-w-md">
            <p className="text-sm text-center text-muted-foreground mb-2">{loadingProgress}</p>
            <Progress value={50} className="h-2" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Market Intelligence Preview
          </h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive view of your available market data (no contact PII shown)
          </p>
        </div>
        {previewData && (
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={onEstimateROI}
            disabled={isEstimatingROI}
            className="gap-2"
          >
            <LaunchPulseMark className="h-3 w-3" />
            {isEstimatingROI ? "Calculating..." : "Estimate ROI"}
          </Button>
        )}
      </div>
      
      {/* ROI Estimate Card */}
      {roiEstimate && (
        <Card className="bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="font-semibold">AI-Projected ROI</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-500">{roiEstimate.estimatedROI}%</div>
                <div className="text-xs text-muted-foreground">Est. ROI</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{roiEstimate.projectedMeetings}</div>
                <div className="text-xs text-muted-foreground">Projected Meetings</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{roiEstimate.projectedDeals}</div>
                <div className="text-xs text-muted-foreground">Projected Deals</div>
              </div>
              <div>
                <div className="text-2xl font-bold">${formatNumber(roiEstimate.projectedRevenue)}</div>
                <div className="text-xs text-muted-foreground">Projected Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Market Intelligence Preview Component */}
      <MarketIntelligencePreview 
        dataSource={dataSource}
        fitScoreMin={fitScoreMin}
        fitScoreMax={fitScoreMax}
      />
      
      {/* Deduplication Warning */}
      {duplicateEmails.size > 0 && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>{duplicateEmails.size}</strong> accounts have been previously exported or already exist as CRM leads.
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exclude-duplicates"
                  checked={excludeDuplicates}
                  onCheckedChange={(checked) => setExcludeDuplicates(checked === true)}
                />
                <Label htmlFor="exclude-duplicates">Exclude duplicates</Label>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Score Band Breakdown */}
      {previewData && previewData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{formatNumber(scoreBandBreakdown.A)}</div>
                <div className="text-xs text-muted-foreground">A-Band (70-100)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{formatNumber(scoreBandBreakdown.B)}</div>
                <div className="text-xs text-muted-foreground">B-Band (40-69)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{formatNumber(scoreBandBreakdown.C)}</div>
                <div className="text-xs text-muted-foreground">C-Band (0-39)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apollo TAM Summary for database source */}
      {dataSource === 'database' && apolloTamData && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Apollo Available Market
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-2xl font-bold">{formatNumber(apolloTamData.total_accounts || 0)}</div>
                <div className="text-xs text-muted-foreground">Total Accounts</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatNumber(apolloTamData.total_contacts || 0)}</div>
                <div className="text-xs text-muted-foreground">Total Contacts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-500">{formatNumber(apolloTamData.credits_remaining || 0)}</div>
                <div className="text-xs text-muted-foreground">Credits Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{Object.keys(apolloTamData.industry_breakdown || {}).length}</div>
                <div className="text-xs text-muted-foreground">Industries</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This data represents your Apollo available market. Select "Apollo" as destination in the next step to redeem contacts.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Account Preview Table (no PII) - shown for CRM sources */}
      {dataSource !== 'database' && previewData && previewData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sample Accounts ({formatNumber(previewData?.length || 0)} total)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-sm font-medium">Account</th>
                    <th className="text-left p-2 text-sm font-medium">Industry</th>
                    <th className="text-left p-2 text-sm font-medium">Country</th>
                    <th className="text-right p-2 text-sm font-medium">Fit Score</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData?.slice(0, 10).map((account: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-sm">{account.name}</td>
                      <td className="p-2 text-sm">{account.industry_norm}</td>
                      <td className="p-2 text-sm">{account.country}</td>
                      <td className="p-2 text-sm text-right">
                        <Badge variant={account.overall_score >= 70 ? "default" : account.overall_score >= 40 ? "secondary" : "outline"} 
                               className={account.overall_score >= 70 ? "bg-green-500" : ""}>
                          {account.overall_score}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
