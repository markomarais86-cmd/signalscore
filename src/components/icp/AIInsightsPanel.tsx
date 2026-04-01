import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  Users, 
  Target,
  Lightbulb,
  BarChart3,
  Loader2
} from 'lucide-react';
import { LaunchPulseMark } from '@/components/BrandLogo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ICPFormData } from '@/types/icp';

interface AIInsightsPanelProps {
  formData: ICPFormData;
  onApplyRecommendation: (recommendation: Partial<ICPFormData>) => void;
}

interface AIRecommendation {
  recommendation: string;
  dataAnalysis: {
    totalAccounts: number;
    topIndustries: string[];
    topCountries: string[];
    revenueRanges: string[];
    companySizes: string[];
  };
}

export function AIInsightsPanel({ formData, onApplyRecommendation }: AIInsightsPanelProps) {
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const generateRecommendations = async () => {
    if (!userProfile?.org_id) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-icp-recommendations', {
        body: { org_id: userProfile.org_id }
      });

      if (error) throw error;

      if (data.success) {
        setAiRecommendation(data);
      } else {
        throw new Error(data.error || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI recommendations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyQuickRecommendation = (type: 'industry' | 'geography' | 'size') => {
    if (!aiRecommendation?.dataAnalysis) return;

    const { dataAnalysis } = aiRecommendation;
    const updates: Partial<ICPFormData> = {};

    switch (type) {
      case 'industry':
        updates.industries = [...new Set([...formData.industries, ...dataAnalysis.topIndustries])];
        break;
      case 'geography':
        updates.geographies = [...new Set([...formData.geographies, ...dataAnalysis.topCountries])];
        break;
      case 'size':
        // Convert size ranges to numbers for company_sizes
        const sizeMapping: { [key: string]: number[] } = {
          '1-10': [1, 10],
          '11-50': [11, 50], 
          '51-200': [51, 200],
          '201-1000': [201, 1000],
          '1000+': [1000]
        };
        
        const newSizes: number[] = [];
        dataAnalysis.companySizes.forEach(range => {
          const sizes = sizeMapping[range];
          if (sizes) newSizes.push(...sizes);
        });
        
        updates.company_sizes = [...new Set([...formData.company_sizes, ...newSizes])];
        break;
    }

    onApplyRecommendation(updates);
    toast({
      title: "Applied",
      description: `Updated ${type} criteria based on your data`,
    });
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LaunchPulseMark className="h-5 w-5 text-primary" />
          AI ICP Assistant
        </CardTitle>
        <CardDescription>
          Get data-driven recommendations based on your CRM data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Analyzing your CRM data...</p>
            <div className="p-4 bg-background/80 rounded-lg border space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        ) : !aiRecommendation ? (
          <div className="text-center py-6">
            <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-4">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Analyze Your Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Let AI analyze your CRM data to suggest the most effective ICP targeting
            </p>
            <Button 
              onClick={generateRecommendations} 
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <LaunchPulseMark className="h-4 w-4" />
              Generate Recommendations
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* AI Recommendation */}
            <div className="p-4 bg-background/80 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2">AI Recommendation</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {aiRecommendation.recommendation}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Data Insights */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Your Data Insights
              </h4>
              
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Accounts</span>
                  <Badge variant="secondary">
                    {aiRecommendation.dataAnalysis.totalAccounts}
                  </Badge>
                </div>

                {aiRecommendation.dataAnalysis.topIndustries.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground">Top Industries</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => applyQuickRecommendation('industry')}
                        className="h-auto p-1 text-xs"
                      >
                        Apply
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {aiRecommendation.dataAnalysis.topIndustries.map((industry, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {industry}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {aiRecommendation.dataAnalysis.topCountries.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground">Top Countries</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => applyQuickRecommendation('geography')}
                        className="h-auto p-1 text-xs"
                      >
                        Apply
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {aiRecommendation.dataAnalysis.topCountries.map((country, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {country}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {aiRecommendation.dataAnalysis.companySizes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground">Company Sizes</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => applyQuickRecommendation('size')}
                        className="h-auto p-1 text-xs"
                      >
                        Apply
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {aiRecommendation.dataAnalysis.companySizes.map((size, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {size} employees
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={generateRecommendations}
                disabled={isGenerating}
                className="flex items-center gap-1"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}