import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  showTagline?: boolean;
  collapsed?: boolean;
}

// Geometric chevron mark - the LaunchPulse brand icon
function ChevronMark({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-8 h-8", className)}
    >
      {/* Outer chevron */}
      <path 
        d="M6 24 L16 8 L26 24" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="text-primary"
      />
      {/* Inner chevron for depth */}
      <path 
        d="M11 20 L16 12 L21 20" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  );
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

  // Collapsed state - show just icon
  if (isCollapsed) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <ChevronMark className="w-7 h-7" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <ChevronMark className="w-8 h-8" />
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
      </div>
      {showTagline && (
        <p className={cn(
          "text-xs mt-0.5 ml-10",
          variant === "light" ? "text-muted-foreground" : "text-muted"
        )}>
          Where GTM Meets ICP Precision
        </p>
      )}
    </div>
  );
}
