import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useICPScoring } from "@/hooks/use-icp-scoring";
import { Database, Target, AlertTriangle, CheckCircle, Calculator } from "lucide-react";
import { useEffect } from "react";

export function CRMAnalysis() {
  const { 
    icpProfiles, 
    accounts, 
    loading, 
    scoreAllAccounts, 
    getICPFitAnalysis, 
    getDataQuality 
  } = useICPScoring();

  const fitAnalysis = getICPFitAnalysis();
  const dataQuality = getDataQuality();

  useEffect(() => {
    if (icpProfiles.length > 0 && accounts.length > 0) {
      scoreAllAccounts();
    }
  }, [icpProfiles.length, accounts.length]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Calculator className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p>Calculating ICP scores...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            CRM Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No account data found. Please upload your CRM data first to see ICP fit analysis.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (icpProfiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            CRM Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No ICP profiles defined. Please create at least one ICP profile to analyze your CRM data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ICP Fit Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            ICP Fit Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            How well your CRM data matches your defined ICP criteria
          </p>
        </CardHeader>
        <CardContent>
          {fitAnalysis && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{fitAnalysis.total}</div>
                  <div className="text-sm text-muted-foreground">Total Accounts</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[hsl(var(--signal-high))]">
                    {fitAnalysis.highFit}
                  </div>
                  <div className="text-sm text-muted-foreground">High Fit (75%+)</div>
                  <Badge className="mt-1 bg-[hsl(var(--signal-high))] text-white text-xs">
                    {fitAnalysis.highFitPercentage}%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[hsl(var(--signal-medium))]">
                    {fitAnalysis.mediumFit}
                  </div>
                  <div className="text-sm text-muted-foreground">Medium Fit (50-74%)</div>
                  <Badge className="mt-1 bg-[hsl(var(--signal-medium))] text-white text-xs">
                    {fitAnalysis.mediumFitPercentage}%
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[hsl(var(--signal-low))]">
                    {fitAnalysis.lowFit}
                  </div>
                  <div className="text-sm text-muted-foreground">Low Fit (&lt;50%)</div>
                  <Badge className="mt-1 bg-[hsl(var(--signal-low))] text-white text-xs">
                    {fitAnalysis.lowFitPercentage}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>High ICP Fit</span>
                    <span>{fitAnalysis.highFitPercentage}%</span>
                  </div>
                  <Progress 
                    value={fitAnalysis.highFitPercentage} 
                    className="h-2"
                    style={{ 
                      '--progress-background': 'hsl(var(--signal-high))'
                    } as React.CSSProperties}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Medium ICP Fit</span>
                    <span>{fitAnalysis.mediumFitPercentage}%</span>
                  </div>
                  <Progress 
                    value={fitAnalysis.mediumFitPercentage} 
                    className="h-2"
                    style={{ 
                      '--progress-background': 'hsl(var(--signal-medium))'
                    } as React.CSSProperties}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Low ICP Fit</span>
                    <span>{fitAnalysis.lowFitPercentage}%</span>
                  </div>
                  <Progress 
                    value={fitAnalysis.lowFitPercentage} 
                    className="h-2"
                    style={{ 
                      '--progress-background': 'hsl(var(--signal-low))'
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              {fitAnalysis.highFitPercentage < 25 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Only {fitAnalysis.highFitPercentage}% of your accounts are high ICP fits. 
                    Consider refining your ICP criteria or enriching your account data.
                  </AlertDescription>
                </Alert>
              )}

              {fitAnalysis.highFitPercentage >= 50 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Excellent! {fitAnalysis.highFitPercentage}% of your accounts are high ICP fits. 
                    Focus your sales efforts on these high-value targets.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Quality Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Quality Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Data completeness affects ICP scoring accuracy
          </p>
        </CardHeader>
        <CardContent>
          {dataQuality && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">
                  {dataQuality.overallCompleteness}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Overall Data Completeness
                </div>
                <Progress value={dataQuality.overallCompleteness} className="mt-3" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold mb-1">
                    {dataQuality.completeness.industry}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Industry Data</div>
                  <Progress value={dataQuality.completeness.industry} className="h-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold mb-1">
                    {dataQuality.completeness.employeeCount}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Company Size</div>
                  <Progress value={dataQuality.completeness.employeeCount} className="h-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold mb-1">
                    {dataQuality.completeness.revenue}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Revenue Data</div>
                  <Progress value={dataQuality.completeness.revenue} className="h-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold mb-1">
                    {dataQuality.completeness.country}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Geography</div>
                  <Progress value={dataQuality.completeness.country} className="h-2" />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Recommendations:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {dataQuality.completeness.industry < 70 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Enrich industry data for {100 - dataQuality.completeness.industry}% of accounts to improve ICP matching
                    </li>
                  )}
                  {dataQuality.completeness.employeeCount < 70 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Add company size data for better firm size targeting
                    </li>
                  )}
                  {dataQuality.completeness.revenue < 70 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Revenue range data missing for {100 - dataQuality.completeness.revenue}% of accounts
                    </li>
                  )}
                  {dataQuality.completeness.country < 70 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Geographic data incomplete for regional ICP analysis
                    </li>
                  )}
                  {dataQuality.overallCompleteness >= 80 && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Excellent data quality! Your ICP scores should be highly accurate
                    </li>
                  )}
                </ul>
              </div>

              <Button 
                onClick={scoreAllAccounts}
                disabled={loading}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {loading ? 'Recalculating...' : 'Recalculate ICP Scores'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}