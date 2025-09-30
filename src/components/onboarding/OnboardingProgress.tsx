import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useNavigate } from "react-router-dom";

export function OnboardingProgress() {
  const { onboarding, startOnboarding, resetOnboarding, progress } = useOnboarding();
  const navigate = useNavigate();

  if (onboarding.isComplete) return null;

  const completedCount = onboarding.steps.filter(s => s.completed).length;
  const currentStep = onboarding.steps[onboarding.currentStep];

  return (
    <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Setup Progress</h3>
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {onboarding.steps.length} steps completed
                </p>
              </div>
              <Badge variant="outline" className="text-base font-bold">
                {progress}%
              </Badge>
            </div>

            <Progress value={progress} className="h-2" />

            <div className="flex items-center gap-2 pt-2">
              {onboarding.steps.map((step) => (
                <div
                  key={step.id}
                  className={`
                    flex-1 h-1 rounded-full transition-all
                    ${step.completed ? 'bg-[hsl(var(--signal-high))]' : 'bg-muted'}
                  `}
                />
              ))}
            </div>

            {!currentStep.completed && (
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Next: {currentStep.title}</p>
                  <p className="text-xs text-muted-foreground">{currentStep.description}</p>
                </div>
                <div className="flex gap-2">
                  {currentStep.route && (
                    <Button
                      size="sm"
                      onClick={() => navigate(currentStep.route!)}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {progress === 100 && (
              <div className="flex items-center gap-2 pt-2">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--signal-high))]" />
                <span className="text-sm font-medium text-[hsl(var(--signal-high))]">
                  Setup complete! You're ready to go.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={startOnboarding}
            >
              View Guide
            </Button>
            {progress > 0 && progress < 100 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetOnboarding}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
