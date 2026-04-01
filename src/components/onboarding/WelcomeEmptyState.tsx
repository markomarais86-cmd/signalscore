import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Target, BarChart3, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/use-onboarding";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

interface WelcomeEmptyStateProps {
  /** Which page is showing this. Used to highlight the relevant step. */
  highlightStep?: "upload_data" | "create_icp" | "view_scores" | "explore_dashboard";
  /** Compact mode for non-dashboard pages */
  compact?: boolean;
}

const steps = [
  {
    id: "upload_data",
    icon: Upload,
    title: "Upload Your Data",
    description: "Import accounts & contacts from CSV",
    route: "/data-upload",
    badge: "Step 1",
  },
  {
    id: "create_icp",
    icon: Target,
    title: "Define Your ICP",
    description: "Set ideal customer criteria",
    route: "/icp-manager",
    badge: "Step 2",
  },
  {
    id: "view_scores",
    icon: BarChart3,
    title: "Review Scores",
    description: "See how accounts match your ICP",
    route: "/accounts",
    badge: "Step 3",
  },
];

export function WelcomeEmptyState({ highlightStep, compact = false }: WelcomeEmptyStateProps) {
  const navigate = useNavigate();
  const { onboarding, startOnboarding } = useOnboarding();

  if (compact) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="py-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10">
            <LaunchPulseMark className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">No data yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {highlightStep === "upload_data" && "Start by uploading your accounts and contacts to populate this page."}
              {highlightStep === "create_icp" && "Define your Ideal Customer Profile to start scoring accounts."}
              {highlightStep === "view_scores" && "Upload data and create an ICP to see account scores here."}
              {!highlightStep && "Complete the setup steps to see data on this page."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {highlightStep && (
              <Button onClick={() => navigate(steps.find(s => s.id === highlightStep)?.route || "/data-upload")}>
                <ArrowRight className="h-4 w-4 mr-2" />
                {steps.find(s => s.id === highlightStep)?.title || "Get Started"}
              </Button>
            )}
            <Button variant="outline" onClick={startOnboarding}>
              View Setup Guide
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 mb-2">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to LaunchPulse</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Get your GTM intelligence platform running in 3 steps. Upload your data, define your ideal customer, and start scoring.
        </p>
      </div>

      {/* Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, index) => {
          const isCompleted = onboarding.steps.find(s => s.id === step.id)?.completed;
          const isHighlighted = highlightStep === step.id;
          const Icon = step.icon;

          return (
            <Card
              key={step.id}
              className={cn(
                "relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
                isHighlighted && "ring-2 ring-primary border-primary",
                isCompleted && "bg-[hsl(var(--signal-high))]/5 border-[hsl(var(--signal-high))]/30"
              )}
              onClick={() => navigate(step.route)}
            >
              <CardContent className="pt-6 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {step.badge}
                  </Badge>
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-[hsl(var(--signal-high))]" />
                  )}
                </div>
                <div className={cn(
                  "inline-flex items-center justify-center p-3 rounded-xl",
                  isCompleted ? "bg-[hsl(var(--signal-high))]/10" : "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "h-6 w-6",
                    isCompleted ? "text-[hsl(var(--signal-high))]" : "text-primary"
                  )} />
                </div>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                <Button
                  variant={isCompleted ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                >
                  {isCompleted ? "View" : "Start"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick action */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">Want to explore first?</p>
        <Button variant="outline" onClick={startOnboarding}>
          <Sparkles className="h-4 w-4 mr-2" />
          Open Setup Guide
        </Button>
      </div>
    </div>
  );
}
