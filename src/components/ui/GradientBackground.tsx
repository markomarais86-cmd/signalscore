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
      
      {/* Floating Orbs - only in dark mode - PROMINENT like login screen */}
      {showOrbs && isDark && (
        <>
          {/* Main left glow - matching login screen prominence */}
          <div 
            className="floating-orb w-[900px] h-[900px] top-[10%] -left-[300px] animate-float"
            style={{ background: 'radial-gradient(circle, hsl(161 85% 45% / 0.45), hsl(161 80% 40% / 0.20) 40%, transparent 65%)' }}
          />
          
          {/* Top center wash */}
          <div 
            className="floating-orb w-[800px] h-[600px] -top-[200px] left-[25%] animate-float-delayed"
            style={{ background: 'radial-gradient(ellipse, hsl(161 88% 50% / 0.35), hsl(170 80% 45% / 0.12) 50%, transparent 70%)' }}
          />
          
          {/* Right side accent */}
          <div 
            className="floating-orb w-[600px] h-[700px] top-[15%] right-[-150px] animate-float"
            style={{ 
              background: 'radial-gradient(circle, hsl(170 85% 50% / 0.28), hsl(161 80% 45% / 0.10) 45%, transparent 65%)',
              animationDelay: '0.5s'
            }}
          />
          
          {/* Bottom-left orb */}
          <div 
            className="floating-orb w-[550px] h-[550px] bottom-[0%] left-[5%] animate-float-delayed"
            style={{ 
              background: 'radial-gradient(circle, hsl(165 80% 45% / 0.25), hsl(180 70% 40% / 0.10) 45%, transparent 65%)',
              animationDelay: '1.5s'
            }}
          />
          
          {/* Bottom-right accent */}
          <div 
            className="floating-orb w-[450px] h-[450px] bottom-[15%] right-[8%] animate-float"
            style={{ 
              background: 'radial-gradient(circle, hsl(161 85% 50% / 0.20), transparent 55%)',
              animationDelay: '2s'
            }}
          />
          
          {/* Center ambient glow */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[900px] rounded-full pointer-events-none"
            style={{ 
              background: 'radial-gradient(ellipse, hsl(161 85% 50% / 0.12), transparent 55%)'
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
