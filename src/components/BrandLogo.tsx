import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  showTagline?: boolean;
  collapsed?: boolean;
}

export function BrandLogo({ 
  variant = "light", 
  className,
  showTagline = false,
  collapsed: collapsedProp
}: BrandLogoProps) {
  // Try to use sidebar context, but don't fail if not available
  let sidebarCollapsed = false;
  try {
    const sidebar = useSidebar();
    sidebarCollapsed = sidebar.state === "collapsed";
  } catch {
    // Not in sidebar context, use prop
  }
  
  const isCollapsed = collapsedProp ?? sidebarCollapsed;

  // Collapsed state - show just "LP" icon
  if (isCollapsed) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn(
          "text-lg font-bold font-heading tracking-tight",
          variant === "light" ? "text-primary" : "text-primary"
        )}>
          LP
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn(
        "text-2xl font-bold font-heading tracking-tight",
        variant === "light" ? "text-foreground" : "text-background"
      )}>
        <span className={cn(
          "font-heading font-semibold",
          variant === "light" ? "text-primary" : "text-primary"
        )}>Launch</span>
        <span className={cn(
          variant === "light" ? "text-foreground" : "text-background"
        )}>Pulse</span>
      </div>
      {showTagline && (
        <p className={cn(
          "text-xs mt-0.5",
          variant === "light" ? "text-muted-foreground" : "text-muted"
        )}>
          Where GTM Meets ICP Precision
        </p>
      )}
    </div>
  );
}
