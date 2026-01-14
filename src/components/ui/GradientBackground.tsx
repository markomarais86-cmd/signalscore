import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  variant?: "hero" | "subtle" | "auth";
  showOrbs?: boolean;
}

export function GradientBackground({ 
  children, 
  className,
  variant = "hero",
  showOrbs = true 
}: GradientBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Default to dark mode styling until mounted to prevent flash
  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <div className={cn(
      "relative min-h-screen overflow-hidden",
      isDark ? "hero-gradient" : "bg-white",
      className
    )}>
      {/* Animated Gradient Mesh Overlay - only in dark mode */}
      {isDark && <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />}
      
      {/* Floating Orbs - only in dark mode */}
      {showOrbs && isDark && (
        <>
          {/* Top-left orb - more prominent */}
          <div 
            className="floating-orb w-[700px] h-[700px] -top-[250px] -left-[200px] animate-float"
            style={{ background: 'radial-gradient(circle, hsl(161 85% 50% / 0.25), hsl(161 80% 45% / 0.1) 40%, transparent 70%)' }}
          />
          
          {/* Top-right orb */}
          <div 
            className="floating-orb w-[600px] h-[600px] top-[5%] right-[-150px] animate-float-delayed"
            style={{ background: 'radial-gradient(circle, hsl(161 88% 55% / 0.2), hsl(170 80% 50% / 0.08) 40%, transparent 70%)' }}
          />
          
          {/* Bottom-left orb */}
          <div 
            className="floating-orb w-[500px] h-[500px] bottom-[5%] left-[5%] animate-float"
            style={{ 
              background: 'radial-gradient(circle, hsl(165 80% 45% / 0.18), hsl(180 70% 40% / 0.06) 40%, transparent 70%)',
              animationDelay: '1s'
            }}
          />
          
          {/* Bottom-right accent */}
          <div 
            className="floating-orb w-[400px] h-[400px] bottom-[20%] right-[10%] animate-float-delayed"
            style={{ 
              background: 'radial-gradient(circle, hsl(161 85% 50% / 0.12), transparent 60%)',
              animationDelay: '2s'
            }}
          />
          
          {/* Center glow - more visible */}
          <div 
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] rounded-full pointer-events-none"
            style={{ 
              background: 'radial-gradient(ellipse, hsl(161 85% 50% / 0.08), transparent 50%)'
            }}
          />
        </>
      )}
      
      {/* Grid Pattern Overlay - only in dark mode */}
      {isDark && (
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(hsl(161 85% 60% / 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, hsl(161 85% 60% / 0.3) 1px, transparent 1px)`,
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
