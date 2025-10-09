import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, Upload, Target, BarChart3, TrendingUp, X } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useNavigate } from "react-router-dom";

const stepIcons = {
  upload_data: Upload,
  create_icp: Target,
  view_scores: BarChart3,
  explore_dashboard: TrendingUp
};

export function OnboardingWizard() {
  const { onboarding, skipOnboarding, nextStep, previousStep, progress } = useOnboarding();
  const navigate = useNavigate();

  if (!onboarding.showWizard) return null;

  const currentStepData = onboarding.steps[onboarding.currentStep];
  const Icon = stepIcons[currentStepData.id as keyof typeof stepIcons] || Circle;
  const isLastStep = onboarding.currentStep === onboarding.steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      skipOnboarding();
    } else {
      nextStep();
    }
  };

  const handleStartStep = () => {
    if (currentStepData.route) {
      navigate(currentStepData.route);
      skipOnboarding();
    }
  };

  return (
    <Dialog open={onboarding.showWizard} onOpenChange={(open) => !open && skipOnboarding()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Welcome to LaunchPulse! 🚀</DialogTitle>
            <Button variant="ghost" size="sm" onClick={skipOnboarding}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Let's get you set up in 4 easy steps. Your progress: {progress}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {onboarding.currentStep + 1} of {onboarding.steps.length}</span>
              <span>{progress}% complete</span>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex justify-between">
            {onboarding.steps.map((step, index) => {
              const StepIcon = stepIcons[step.id as keyof typeof stepIcons] || Circle;
              const isCurrent = index === onboarding.currentStep;
              const isPast = index < onboarding.currentStep || step.completed;
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2">
                  <div className={`
                    rounded-full p-3 transition-all
                    ${isCurrent ? 'bg-primary text-primary-foreground scale-110' : ''}
                    ${isPast && !isCurrent ? 'bg-[hsl(var(--signal-high))]/20 text-[hsl(var(--signal-high))]' : ''}
                    ${!isPast && !isCurrent ? 'bg-muted text-muted-foreground' : ''}
                  `}>
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`text-xs font-medium max-w-[80px] text-center ${
                    isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current step details */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">{currentStepData.title}</h3>
                  {currentStepData.completed && (
                    <Badge className="bg-[hsl(var(--signal-high))]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{currentStepData.description}</p>
              </div>
            </div>

            {/* Step-specific guidance */}
            <div className="border-l-2 border-primary pl-4 space-y-2">
              {currentStepData.id === 'upload_data' && (
                <>
                  <p className="text-sm font-medium">What you'll do:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Download our CSV template</li>
                    <li>• Upload your accounts and contacts data</li>
                    <li>• Map fields to our system</li>
                  </ul>
                </>
              )}
              {currentStepData.id === 'create_icp' && (
                <>
                  <p className="text-sm font-medium">What you'll do:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Choose an ICP template or start from scratch</li>
                    <li>• Define target industries, company sizes, and geographies</li>
                    <li>• Set persona criteria for decision-makers</li>
                  </ul>
                </>
              )}
              {currentStepData.id === 'view_scores' && (
                <>
                  <p className="text-sm font-medium">What you'll see:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Overall fit scores for each account (0-100)</li>
                    <li>• Breakdown of Fit, Intent, and Reachability</li>
                    <li>• AI-powered technology insights</li>
                  </ul>
                </>
              )}
              {currentStepData.id === 'explore_dashboard' && (
                <>
                  <p className="text-sm font-medium">What you'll discover:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• TAM coverage and market penetration metrics</li>
                    <li>• ICP match quality vs. industry benchmarks</li>
                    <li>• Whitespace opportunities for expansion</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={onboarding.currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStepData.route && !currentStepData.completed && (
              <Button onClick={handleStartStep}>
                Start This Step
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            
            <Button variant={isLastStep ? "default" : "outline"} onClick={handleNext}>
              {isLastStep ? 'Complete Setup' : 'Next'}
              {!isLastStep && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
