import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, TrendingUp, Target, Users, Lightbulb } from "lucide-react";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";

interface ScoreBreakdownDialogProps {
  isOpen: boolean;
  onClose: () => void;
  account: {
    name: string;
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
    reasons?: {
      fit_positives?: string[];
      fit_negatives?: string[];
      intent_signals?: string[];
      reachability_factors?: string[];
    };
  } | null;
}

const ScoreExplanation = ({ score }: { score: number }) => {
  if (score >= 75) return { color: "text-[hsl(var(--signal-high))]", label: "Excellent Match", desc: "Strong alignment with ICP" };
  if (score >= 50) return { color: "text-[hsl(var(--signal-medium))]", label: "Good Match", desc: "Moderate alignment with ICP" };
  return { color: "text-[hsl(var(--signal-low))]", label: "Low Match", desc: "Limited alignment with ICP" };
};

export function ScoreBreakdownDialog({ isOpen, onClose, account }: ScoreBreakdownDialogProps) {
  if (!account) return null;

  const fitExplanation = ScoreExplanation({ score: account.fit });
  const intentExplanation = ScoreExplanation({ score: account.intent });
  const reachabilityExplanation = ScoreExplanation({ score: account.reachability });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Score Breakdown: {account.name}
          </DialogTitle>
          <DialogDescription>
            Understand how this account's SignalScore is calculated
          </DialogDescription>
        </DialogHeader>

        {/* Overall Score Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Overall SignalScore</span>
              <SignalScoreDisplay score={account.overall} size="lg" />
            </CardTitle>
            <CardDescription>
              {ScoreExplanation({ score: account.overall }).desc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                The overall score combines three key dimensions that predict account quality and conversion likelihood:
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{account.fit}</div>
                  <div className="text-sm font-medium">Fit Score</div>
                  <div className="text-xs text-muted-foreground">ICP Alignment</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{account.intent}</div>
                  <div className="text-sm font-medium">Intent Score</div>
                  <div className="text-xs text-muted-foreground">Buying Signals</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{account.reachability}</div>
                  <div className="text-sm font-medium">Reachability</div>
                  <div className="text-xs text-muted-foreground">Engagement Potential</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fit Score Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <CardTitle>Fit Score: {account.fit}</CardTitle>
              </div>
              <Badge className={fitExplanation.color}>{fitExplanation.label}</Badge>
            </div>
            <CardDescription>
              How well this account matches your Ideal Customer Profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={account.fit} className="h-2" />
            
            {account.reasons?.fit_positives && account.reasons.fit_positives.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--signal-high))]" />
                  Positive Factors
                </div>
                <ul className="space-y-1">
                  {account.reasons.fit_positives.map((factor, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-[hsl(var(--signal-high))]">+</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {account.reasons?.fit_negatives && account.reasons.fit_negatives.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-[hsl(var(--signal-low))]" />
                  Areas for Consideration
                </div>
                <ul className="space-y-1">
                  {account.reasons.fit_negatives.map((factor, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-[hsl(var(--signal-low))]">-</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(!account.reasons?.fit_positives || account.reasons.fit_positives.length === 0) && 
             (!account.reasons?.fit_negatives || account.reasons.fit_negatives.length === 0) && (
              <Alert>
                <AlertDescription>
                  Fit score is calculated based on industry match, company size, revenue range, geography, and other ICP criteria.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Intent Score Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle>Intent Score: {account.intent}</CardTitle>
              </div>
              <Badge className={intentExplanation.color}>{intentExplanation.label}</Badge>
            </div>
            <CardDescription>
              Buying signals and readiness to engage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={account.intent} className="h-2" />
            
            {account.reasons?.intent_signals && account.reasons.intent_signals.length > 0 ? (
              <div>
                <div className="text-sm font-medium mb-2">Detected Signals</div>
                <ul className="space-y-1">
                  {account.reasons.intent_signals.map((signal, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--signal-high))] mt-0.5" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Intent signals include technology adoption, job postings, funding events, leadership changes, and website engagement patterns.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Reachability Score Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Reachability Score: {account.reachability}</CardTitle>
              </div>
              <Badge className={reachabilityExplanation.color}>{reachabilityExplanation.label}</Badge>
            </div>
            <CardDescription>
              How easy it is to connect with decision-makers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={account.reachability} className="h-2" />
            
            {account.reasons?.reachability_factors && account.reasons.reachability_factors.length > 0 ? (
              <div>
                <div className="text-sm font-medium mb-2">Contributing Factors</div>
                <ul className="space-y-1">
                  {account.reasons.reachability_factors.map((factor, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Reachability considers contact data quality, email deliverability, engagement history, and persona match to your target decision-makers.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {account.fit < 75 && (
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Verify ICP criteria match - consider refining your ICP definition if many good accounts score low</span>
                </li>
              )}
              {account.intent < 50 && (
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Enrich with intent data providers to capture buying signals and technology adoption patterns</span>
                </li>
              )}
              {account.reachability < 50 && (
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Add more contacts and verify email addresses to improve reachability score</span>
                </li>
              )}
              {account.overall >= 75 && (
                <li className="flex items-start gap-2">
                  <span className="text-[hsl(var(--signal-high))]">✓</span>
                  <span className="font-medium">Prioritize this account - high conversion potential across all dimensions</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
