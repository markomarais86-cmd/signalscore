import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  showTagline?: boolean;
  collapsed?: boolean;
}

// Pulse/wave icon mark SVG component
function PulseIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-8 h-8", className)}
    >
      {/* Pulse wave lines */}
      <path 
        d="M4 16h4l3-8 4 16 4-12 3 4h6" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="text-primary"
      />
      {/* Glow circle behind */}
      <circle 
        cx="16" 
        cy="16" 
        r="14" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeOpacity="0.3"
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
        <PulseIcon className="w-7 h-7" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <PulseIcon className="w-8 h-8" />
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
