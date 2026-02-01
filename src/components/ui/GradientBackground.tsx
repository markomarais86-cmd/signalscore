import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  variant?: "hero" | "subtle" | "auth";
  showOrbs?: boolean;
  forceDark?: boolean;
}

export function GradientBackground({ 
  children, 
  className,
  variant = "hero",
  showOrbs = true,
  forceDark = false
}: GradientBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = forceDark || !mounted || resolvedTheme === "dark";

  return (
    <div className={cn(
      "relative min-h-screen overflow-hidden",
      isDark ? "bg-black" : "bg-white",
      className
    )}>
      {/* Grid Pattern Only - Matching original launchpulse.org */}
      {isDark && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
