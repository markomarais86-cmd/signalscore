import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { useICPInsights } from '@/hooks/use-icp-insights';
import { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

interface ICPWizardStep5Props {
  formData: ICPFormData;
  onValidate?: () => void;
}

export function ICPWizardStep5({ formData, onValidate }: ICPWizardStep5Props) {
  const { insights, statistics, loading, generateInsights } = useICPInsights();

  useEffect(() => {
    // Generate insights when component mounts
    generateInsights();
  }, []);

  return (
    <div className="space-y-6">
      {/* AI Insights Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <CardTitle>AI-Powered ICP Insights</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateInsights()}
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Refresh Insights'}
            </Button>
          </div>
          <CardDescription>
            Based on your {statistics?.total_accounts || 0} accounts and {statistics?.total_deals || 0} closed deals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <Alert key={index}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={insight.priority === 'high' ? 'default' : 'secondary'}>
                          {insight.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {insight.confidence}% confidence
                        </Badge>
                        <span className="text-sm font-semibold">{insight.title}</span>
                      </div>
                      <AlertDescription className="text-sm">
                        {insight.description}
                      </AlertDescription>
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        💡 Impact: {insight.impact}
                      </p>
                      {insight.relatedSegments && insight.relatedSegments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {insight.relatedSegments.map((segment, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {segment}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No insights available yet. Make sure your accounts are scored to generate AI-powered recommendations.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <CardTitle>Review Your ICP Profile</CardTitle>
          </div>
          <CardDescription>
            Review the ideal customer profile before saving
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Profile Name</Label>
                <p className="text-sm text-muted-foreground">{formData.name || 'Untitled ICP'}</p>
              </div>
              
              {formData.industries.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Industries ({formData.industries.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.industries.slice(0, 3).map((industry, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{industry}</Badge>
                    ))}
                    {formData.industries.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{formData.industries.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}

              {formData.company_sizes.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Company Sizes ({formData.company_sizes.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.company_sizes.slice(0, 3).map((size, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{size}+ employees</Badge>
                    ))}
                    {formData.company_sizes.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{formData.company_sizes.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {formData.persona_job_titles.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Job Titles ({formData.persona_job_titles.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.persona_job_titles.slice(0, 3).map((title, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{title}</Badge>
                    ))}
                    {formData.persona_job_titles.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{formData.persona_job_titles.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}

              {formData.geographies.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Countries ({formData.geographies.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.geographies.slice(0, 3).map((geo, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{geo}</Badge>
                    ))}
                    {formData.geographies.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{formData.geographies.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}

              {formData.tags.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Tags ({formData.tags.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                    {formData.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{formData.tags.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      {onValidate && (
        <div className="flex justify-end">
          <Button onClick={onValidate} className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}