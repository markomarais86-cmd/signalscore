import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

interface Step {
  number: number;
  title: string;
  description: string;
  path: string;
  completed: boolean;
}

interface WorkflowStepperProps {
  currentStep: number;
  className?: string;
}

export function WorkflowStepper({ currentStep, className }: WorkflowStepperProps) {
  const steps: Step[] = [
    {
      number: 1,
      title: "Upload Data",
      description: "Import CRM data",
      path: "/data-upload",
      completed: currentStep > 1
    },
    {
      number: 2,
      title: "Fit Analysis",
      description: "ICP match rate",
      path: "/icp-analysis",
      completed: currentStep > 2
    },
    {
      number: 3,
      title: "TAM Analysis",
      description: "Size the market",
      path: "/icp-tam",
      completed: currentStep > 3
    },
    {
      number: 4,
      title: "Prioritization",
      description: "Pipeline insights",
      path: "/pipeline",
      completed: currentStep > 4
    },
    {
      number: 5,
      title: "Reporting",
      description: "Executive dashboard",
      path: "/",
      completed: currentStep > 5
    }
  ];

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <Link
              to={step.path}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                  step.completed
                    ? "bg-secondary text-secondary-foreground"
                    : step.number === currentStep
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step.completed ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    "text-xs font-medium",
                    step.number === currentStep
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </div>
              </div>
            </Link>
            
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 transition-all",
                  step.completed
                    ? "bg-secondary"
                    : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
