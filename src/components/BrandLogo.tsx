import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  showTagline?: boolean;
  collapsed?: boolean;
}

// LaunchPulse brand mark - the geometric logo icon
export function LaunchPulseMark({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 1000 1000" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-8 h-8", className)}
    >
      <path 
        d="M684.9,724.2l-27.4-56.7c0,0-27.5-58.1-39.7-84c-3.5-7.4-11-12.2-19.2-12.2l-104.6,0l104-104.6l1.1-1.4
        c11.6-16.2,3-38.6,2-41l-54.3-115.4l-16.2-33L331.1,473.3c-23.9,20.1-14.1,45.1-13.6,46.3l33.7,69.9l0.1,0.3
        c3.4,6.4,9.4,10.2,16,10.2c1.8,0,57.8,0,57.8,0l-19.4,18.9l-19.9,19.9c-4.2,4-7,11.2-3.8,18.3c0.7,1.4,1.6,3.5,2.9,6.1l14.8,30.6
        l0,0l0,0l5.2,10.1c0,0,0,0,0,0l6.5,12.7c1.5,2.9,3.9,5.4,6.9,6.7c1.2,0.5,2.6,0.9,4.1,0.9c5.2,0,21.8,0,21.8,0l0,0
        c0.6,0,1.1,0,1.7,0H684.9z M373.6,571.5l-30.2-62.7c-0.5-1.7-1.6-8.1,6.1-14.4l173.4-171l52.4,111.3c1.5,4.3,3,12.2-3.7,18.9
        L454.4,571.3L373.6,571.5z M440.5,696.2H432l-9.2-19.2l-8.2-17c-2.1-4.4-1.2-9.6,2.3-13l48.3-47.2h129.5
        c0.6,0.9,45.5,96.3,45.5,96.3l0,0H461H440.5z"
        fill="currentColor"
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
        <LaunchPulseMark className="w-7 h-7" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <LaunchPulseMark className="w-8 h-8" />
      <div className={cn(
          "text-2xl font-bold font-heading tracking-tight",
          "text-foreground"
        )}>
          <span className={cn(
            "font-heading font-semibold",
            "text-primary"
          )}>Launch</span>
          <span className={cn(
            variant === "light" ? "text-foreground" : "text-white"
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
