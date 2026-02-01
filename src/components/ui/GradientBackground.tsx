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

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Force dark for marketing pages, otherwise use theme
  const isDark = forceDark || !mounted || resolvedTheme === "dark";

  return (
    <div className={cn(
      "relative min-h-screen overflow-hidden",
      isDark ? "bg-black" : "bg-white",
      className
    )}>
      {/* Pattern 2.0: Curved Aurora Glow at Bottom - Brand Guidelines */}
      {showOrbs && isDark && (
        <>
          {/* Main bottom aurora glow - curved effect */}
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[60vh] pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 50% 80% at 50% 100%, 
                hsl(158 88% 59% / 0.35) 0%, 
                hsl(158 88% 59% / 0.15) 30%, 
                transparent 70%)`
            }}
          />
          
          {/* Subtle top-left accent */}
          <div 
            className="absolute top-0 left-0 w-[50%] h-[40%] pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 80% at 0% 0%, 
                hsl(158 88% 59% / 0.08) 0%, 
                transparent 60%)`
            }}
          />
          
          {/* Very subtle top-right accent */}
          <div 
            className="absolute top-0 right-0 w-[40%] h-[30%] pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 80% at 100% 0%, 
                hsl(158 88% 59% / 0.05) 0%, 
                transparent 60%)`
            }}
          />
        </>
      )}
      
      {/* Grid Pattern Overlay - very subtle */}
      {isDark && (
        <div 
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(hsl(158 88% 59% / 0.4) 1px, transparent 1px),
                             linear-gradient(90deg, hsl(158 88% 59% / 0.4) 1px, transparent 1px)`,
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
