import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingUp, DollarSign, Clock, Target, Building, Users, MapPin, ChevronRight, Upload, Database, FileQuestion, Info } from 'lucide-react';
import { LaunchPulseMark } from "@/components/BrandLogo";
import { useClosedWonAnalysis, ICPRecommendation } from '@/hooks/use-closed-won-analysis';
import { Skeleton } from '@/components/ui/skeleton';
import { SampleDataGenerator } from '@/components/SampleDataGenerator';

interface ClosedWonInsightsProps {
  onCreateICP?: (recommendation: ICPRecommendation) => void;
}

export function ClosedWonInsights({ onCreateICP }: ClosedWonInsightsProps) {
  const navigate = useNavigate();
  const { loading, analysis, analyzeClosedWon, createICPFromRecommendation } = useClosedWonAnalysis();
  const [autoAnalyzed, setAutoAnalyzed] = useState(false);

  useEffect(() => {
    if (!autoAnalyzed) {
      analyzeClosedWon();
      setAutoAnalyzed(true);
    }
  }, []);

  const handleCreateICP = async (recommendation: ICPRecommendation) => {
    const result = await createICPFromRecommendation(recommendation);
    if (result && onCreateICP) {
      onCreateICP(recommendation);
    }
  };

  if (loading && !analysis) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis?.success) {
    return (
      <div className="space-y-6">
        {/* Main Empty State */}
        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center py-8 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
                <Target className="relative h-16 w-16 text-primary" />
              </div>
              
              <div className="space-y-3 max-w-md">
                <h3 className="text-2xl font-bold">Discover Your Ideal Customer Profile</h3>
                <p className="text-muted-foreground">
                  Upload your closed won deals to automatically generate data-driven ICP recommendations 
                  based on your actual wins - including firmographics, deal patterns, and TAM estimates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <Button 
                  onClick={() => navigate('/data-upload?tab=closed-won')} 
                  size="lg" 
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Closed Won Data
                </Button>
                <Button 
                  onClick={() => navigate('/icp-manager')} 
                  variant="outline"
                  size="lg" 
                  className="flex-1"
                >
                  <FileQuestion className="h-4 w-4 mr-2" />
                  Create Manual ICP
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What You'll Get */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LaunchPulseMark className="h-5 w-5" />
              What You'll Discover
            </CardTitle>
            <CardDescription>
              Automated insights from your closed won deals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Firmographic Patterns</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Top industries, company sizes, revenue ranges, and geographies from your wins
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Deal Insights</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Average deal values, sales cycle lengths, and revenue patterns by segment
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">ICP Recommendations</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ready-to-use ICP profiles based on your highest-performing customer segments
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">TAM Estimates</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total addressable market calculations for each recommended ICP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started Options */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Choose how you want to proceed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Don't have closed won data ready?</AlertTitle>
              <AlertDescription>
                <p className="mb-3">You can still use the platform with sample data or create ICPs manually.</p>
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Use Sample Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate realistic sample data to explore all platform features
                  </p>
                  <SampleDataGenerator />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileQuestion className="h-4 w-4" />
                    Manual ICP Creation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Define your ICP manually using templates or from scratch
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/icp-manager')}
                    className="w-full"
                  >
                    Create ICP Manually
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { analysis: stats, recommendations, patterns } = analysis;

  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LaunchPulseMark className="h-5 w-5" />
                Win-Based Intelligence
              </CardTitle>
              <CardDescription>
                Analysis of {stats.valid_deals} closed won deals
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg font-bold">
              {stats.confidence_score}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                ${(stats.total_value / 1000000).toFixed(1)}M
              </div>
              <div className="text-sm text-muted-foreground">Total Won Value</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                ${(stats.avg_deal_value / 1000).toFixed(0)}K
              </div>
              <div className="text-sm text-muted-foreground">Avg Deal Size</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {Math.round(stats.avg_sales_cycle)}
              </div>
              <div className="text-sm text-muted-foreground">Avg Days to Close</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ICP Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended ICP Profile</CardTitle>
            <CardDescription>
              Based on your highest-performing closed won deals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{rec.name}</h3>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                  <Button onClick={() => handleCreateICP(rec)}>
                    Create ICP
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Industries</span>
                    </div>
                    <div className="space-y-1">
                      {rec.industries.slice(0, 3).map((ind, i) => (
                        <Badge key={i} variant="secondary" className="text-xs mr-1">
                          {ind}
                        </Badge>
                      ))}
                      {rec.industries.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{rec.industries.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Company Sizes</span>
                    </div>
                    <div className="space-y-1">
                      {rec.company_sizes.map((size, i) => (
                        <Badge key={i} variant="secondary" className="text-xs mr-1">
                          {size}+ emp
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Revenue</span>
                    </div>
                    <div className="space-y-1">
                      {rec.revenue_ranges.slice(0, 2).map((rev, i) => (
                        <Badge key={i} variant="secondary" className="text-xs mr-1">
                          {rev}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Geographies</span>
                    </div>
                    <div className="space-y-1">
                      {rec.geographies.slice(0, 2).map((geo, i) => (
                        <Badge key={i} variant="secondary" className="text-xs mr-1">
                          {geo}
                        </Badge>
                      ))}
                      {rec.geographies.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{rec.geographies.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3 border-t text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Avg Deal: ${(rec.avg_deal_value / 1000).toFixed(0)}K
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Avg Cycle: {rec.avg_sales_cycle} days
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    TAM: ${(rec.tam_estimate / 1000000).toFixed(1)}M
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Win Patterns */}
      {patterns && (
        <Card>
          <CardHeader>
            <CardTitle>Win Patterns</CardTitle>
            <CardDescription>
              Performance breakdown by segment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {patterns.industries.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Top Industries</h4>
                  <div className="space-y-2">
                    {patterns.industries.slice(0, 5).map((ind, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{ind.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{ind.count} wins</span>
                          <span className="font-medium">${(ind.avg_value / 1000).toFixed(0)}K avg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {patterns.sizes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Top Company Sizes</h4>
                  <div className="space-y-2">
                    {patterns.sizes.slice(0, 3).map((size, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{size.size}+ employees</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{size.count} wins</span>
                          <span className="font-medium">${(size.avg_value / 1000).toFixed(0)}K avg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
