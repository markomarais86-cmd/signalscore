import { useState, ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

interface CollapsibleDashboardCardProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleDashboardCard({ title, icon, defaultOpen = true, children }: CollapsibleDashboardCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-2 px-0.5 text-left group">
        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em]">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
