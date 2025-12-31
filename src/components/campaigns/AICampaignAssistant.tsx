import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, AlertCircle, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface AICampaignAssistantProps {
  step: number;
  icpName?: string;
  targetSegment?: string;
  accountCount?: number;
  avgFitScore?: number;
  dataQuality?: {
    hasEmails: number;
    hasPhones: number;
    hasVerifiedEmails: number;
  };
}

export function AICampaignAssistant({ 
  step, 
  icpName, 
  targetSegment,
  accountCount,
  avgFitScore,
  dataQuality 
}: AICampaignAssistantProps) {
  const { userProfile } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    generateContextualRecommendations();
  }, [step, accountCount, avgFitScore, dataQuality]);

  const generateContextualRecommendations = () => {
    const newRecommendations: any[] = [];
    const newIssues: any[] = [];

    // Step-specific recommendations
    switch (step) {
      case 1:
        if (icpName) {
          newRecommendations.push({
            icon: CheckCircle2,
            text: `Using ICP: ${icpName}`,
            type: "success"
          });
        } else {
          newIssues.push({
            icon: AlertCircle,
            text: "No ICP selected - consider creating one for better targeting",
            severity: "warning"
          });
        }
        break;

      case 2:
        if (accountCount && accountCount < 50) {
          newIssues.push({
            icon: AlertCircle,
            text: `Low target count (${accountCount}). Consider broadening filters.`,
            severity: "warning"
          });
        }
        if (avgFitScore && avgFitScore < 50) {
          newIssues.push({
            icon: AlertCircle,
            text: "Low average fit score. Review ICP criteria alignment.",
            severity: "warning"
          });
        }
        if (avgFitScore && avgFitScore >= 70) {
          newRecommendations.push({
            icon: TrendingUp,
            text: `Strong fit score (${avgFitScore.toFixed(0)}). Expected higher conversion.`,
            type: "success"
          });
        }
        break;

      case 5:
        if (dataQuality) {
          const emailCoverage = accountCount ? (dataQuality.hasEmails / accountCount) * 100 : 0;
          const verifiedRate = dataQuality.hasEmails ? (dataQuality.hasVerifiedEmails / dataQuality.hasEmails) * 100 : 0;

          if (emailCoverage < 50) {
            newIssues.push({
              icon: AlertCircle,
              text: `Only ${emailCoverage.toFixed(0)}% of accounts have emails. Consider enrichment.`,
              severity: "error"
            });
          }
          if (verifiedRate < 70) {
            newIssues.push({
              icon: AlertCircle,
              text: `${verifiedRate.toFixed(0)}% email verification rate. Run verification to improve deliverability.`,
              severity: "warning"
            });
          }
          if (emailCoverage >= 80 && verifiedRate >= 80) {
            newRecommendations.push({
              icon: CheckCircle2,
              text: "Excellent data quality - ready for high-volume outreach",
              type: "success"
            });
          }
        }
        break;
    }

    // General recommendations
    if (accountCount && accountCount > 1000) {
      newRecommendations.push({
        icon: Lightbulb,
        text: "Large campaign - consider segmenting into smaller batches",
        type: "info"
      });
    }

    setRecommendations(newRecommendations);
    setIssues(newIssues);
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Campaign Setup";
      case 2: return "Target Selection";
      case 3: return "Persona Refinement";
      case 4: return "Sequence Design";
      case 5: return "Data Enrichment";
      case 6: return "Review & Launch";
      default: return "AI Assistant";
    }
  };

  return (
    <Card className="h-full border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <LaunchPulseMark className="h-5 w-5" />
          <CardTitle className="text-lg">AI Assistant</CardTitle>
        </div>
        <CardDescription>{getStepTitle()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Issues */}
        {issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Issues to Address
            </h4>
            {issues.map((issue, idx) => (
              <Alert key={idx} variant={issue.severity === "error" ? "destructive" : "default"} className="py-2">
                <issue.icon className="h-4 w-4" />
                <AlertDescription className="text-xs">{issue.text}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Recommendations
            </h4>
            {recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/50">
                <rec.icon className={`h-4 w-4 mt-0.5 ${
                  rec.type === 'success' ? 'text-success' : 
                  rec.type === 'warning' ? 'text-warning' : 
                  'text-primary'
                }`} />
                <span className="text-muted-foreground">{rec.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pro Tips */}
        <div className="pt-4 border-t border-border/50">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <LaunchPulseMark className="h-4 w-4" />
            Pro Tips
          </h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            {step === 1 && (
              <>
                <p>• Use AI-generated names for better tracking</p>
                <p>• Include date/region for clarity</p>
              </>
            )}
            {step === 2 && (
              <>
                <p>• Target 200-500 accounts for optimal management</p>
                <p>• Higher fit scores = better conversion</p>
              </>
            )}
            {step === 4 && (
              <>
                <p>• Enterprise buyers need 5-7 touchpoints</p>
                <p>• Mix channels for 3x better response rates</p>
              </>
            )}
            {step === 5 && (
              <>
                <p>• Apollo offers best coverage for contacts</p>
                <p>• Verify emails before sending to protect sender reputation</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
