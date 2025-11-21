import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MetricTooltipProps {
  title: string;
  description: string;
  example?: string;
}

export function MetricTooltip({ title, description, example }: MetricTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            {example && (
              <p className="text-xs text-primary mt-2">Example: {example}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
