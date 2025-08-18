import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Users, 
  Target,
  BarChart3,
  Lightbulb,
  Eye,
  Download
} from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface ICPWizardStep5Props {
  formData: ICPFormData;
  onValidate?: () => void;
}

interface ValidationResult {
  totalMatches: number;
  dataQualityScore: number;
  tamEstimate: number;
  completeness: {
    basic: number;
    persona: number;
    advanced: number;
    overall: number;
  };
  recommendations: string[];
}

export function ICPWizardStep5({ formData, onValidate }: ICPWizardStep5Props) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    calculateValidation();
  }, [formData]);

  const calculateValidation = async () => {
    setIsValidating(true);
    
    try {
      // Calculate completeness scores
      const basicScore = calculateBasicCompleteness();
      const personaScore = calculatePersonaCompleteness();
      const advancedScore = calculateAdvancedCompleteness();
      const overallScore = Math.round((basicScore + personaScore + advancedScore) / 3);

      // Simulate account matching (in real implementation, this would query the database)
      const accountMatches = await simulateAccountMatching();
      
      // Generate recommendations
      const recommendations = generateRecommendations();

      setValidation({
        totalMatches: accountMatches.total,
        dataQualityScore: 85, // Simulated data quality score
        tamEstimate: accountMatches.tamEstimate,
        completeness: {
          basic: basicScore,
          persona: personaScore,
          advanced: advancedScore,
          overall: overallScore
        },
        recommendations
      });
    } catch (error) {
      console.error('Error calculating validation:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const calculateBasicCompleteness = () => {
    let score = 0;
    let total = 5;

    if (formData.name.trim()) score++;
    if (formData.industries.length > 0) score++;
    if (formData.company_sizes.length > 0) score++;
    if (formData.revenue_ranges.length > 0) score++;
    if (formData.geographies.length > 0) score++;

    return Math.round((score / total) * 100);
  };

  const calculatePersonaCompleteness = () => {
    let score = 0;
    let total = 4;

    if (formData.persona_job_titles.length > 0) score++;
    if (formData.persona_departments.length > 0) score++;
    if (formData.persona_seniority_levels.length > 0) score++;
    if (formData.persona_decision_roles.length > 0) score++;

    return Math.round((score / total) * 100);
  };

  const calculateAdvancedCompleteness = () => {
    let score = 0;
    let total = 6;

    if (formData.company_stages.length > 0) score++;
    if (formData.tech_stack.length > 0) score++;
    if (formData.intent_signals.length > 0) score++;
    if (formData.buying_triggers.length > 0) score++;
    if (formData.seasonal_patterns.length > 0) score++;
    if (formData.budget_indicators.length > 0) score++;

    return Math.round((score / total) * 100);
  };

  const simulateAccountMatching = async () => {
    // In a real implementation, this would query the accounts table
    // For now, we'll simulate based on the criteria
    const baseMatches = Math.floor(Math.random() * 5000) + 1000;
    const tamEstimate = baseMatches * (Math.floor(Math.random() * 500000) + 100000);
    
    return {
      total: baseMatches,
      tamEstimate: tamEstimate
    };
  };

  const generateRecommendations = (): string[] => {
    const recommendations: string[] = [];

    if (formData.industries.length === 0) {
      recommendations.push("Add at least one industry to improve targeting precision");
    }

    if (formData.persona_job_titles.length === 0) {
      recommendations.push("Define target job titles to enhance persona targeting");
    }

    if (formData.company_sizes.length === 0) {
      recommendations.push("Specify company sizes to focus on the right market segment");
    }

    if (formData.intent_signals.length === 0) {
      recommendations.push("Add intent signals to identify high-propensity prospects");
    }

    if (formData.buying_triggers.length === 0) {
      recommendations.push("Include buying triggers to time your outreach effectively");
    }

    if (formData.tech_stack.length === 0) {
      recommendations.push("Add technology stack criteria for better qualification");
    }

    if (recommendations.length === 0) {
      recommendations.push("Your ICP profile looks comprehensive! Consider A/B testing different variations.");
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  };

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <CheckCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Validation & Preview</h2>
          <p className="text-muted-foreground">
            Review your ICP profile and validation results
          </p>
        </div>
      </div>

      {/* Validation Results */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Total Matches</span>
              </div>
              {isValidating ? (
                <div className="animate-pulse w-16 h-6 bg-muted rounded"></div>
              ) : (
                <span className="text-2xl font-bold">{validation ? formatNumber(validation.totalMatches) : '0'}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">TAM Estimate</span>
              </div>
              {isValidating ? (
                <div className="animate-pulse w-16 h-6 bg-muted rounded"></div>
              ) : (
                <span className="text-2xl font-bold">{validation ? formatCurrency(validation.tamEstimate) : '$0'}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium">Data Quality</span>
              </div>
              {isValidating ? (
                <div className="animate-pulse w-16 h-6 bg-muted rounded"></div>
              ) : (
                <span className="text-2xl font-bold">{validation?.dataQualityScore || 0}%</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Completeness Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Profile Completeness
          </CardTitle>
          <CardDescription>
            How complete is your ICP definition across different categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Basic Targeting</span>
              <span className="text-sm text-muted-foreground">{validation?.completeness.basic || 0}%</span>
            </div>
            <Progress value={validation?.completeness.basic || 0} className="h-2" />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Persona Targeting</span>
              <span className="text-sm text-muted-foreground">{validation?.completeness.persona || 0}%</span>
            </div>
            <Progress value={validation?.completeness.persona || 0} className="h-2" />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Advanced Criteria</span>
              <span className="text-sm text-muted-foreground">{validation?.completeness.advanced || 0}%</span>
            </div>
            <Progress value={validation?.completeness.advanced || 0} className="h-2" />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Overall Completeness</span>
              <span className="font-medium">{validation?.completeness.overall || 0}%</span>
            </div>
            <Progress value={validation?.completeness.overall || 0} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommendations
          </CardTitle>
          <CardDescription>
            Suggestions to improve your ICP targeting effectiveness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {validation?.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{recommendation}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Profile Summary
          </CardTitle>
          <CardDescription>
            Overview of your ICP targeting criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
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

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={calculateValidation} disabled={isValidating}>
          {isValidating ? 'Validating...' : 'Re-validate'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Preview
          </Button>
          {onValidate && (
            <Button onClick={onValidate} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Looks Good
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Label component since we're using it
function Label({ className, children, ...props }: { className?: string; children: React.ReactNode }) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ''}`} {...props}>
      {children}
    </label>
  );
}