import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

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
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark" || theme === "dark";

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
          {/* Top-left orb */}
          <div 
            className="floating-orb w-[600px] h-[600px] -top-[200px] -left-[200px] animate-float"
            style={{ background: 'radial-gradient(circle, hsl(161 85% 60% / 0.15), transparent 70%)' }}
          />
          
          {/* Top-right orb */}
          <div 
            className="floating-orb w-[500px] h-[500px] top-[10%] right-[-100px] animate-float-delayed"
            style={{ background: 'radial-gradient(circle, hsl(161 88% 67% / 0.12), transparent 70%)' }}
          />
          
          {/* Bottom-left orb */}
          <div 
            className="floating-orb w-[400px] h-[400px] bottom-[10%] left-[5%] animate-float"
            style={{ 
              background: 'radial-gradient(circle, hsl(210 88% 50% / 0.08), transparent 70%)',
              animationDelay: '1s'
            }}
          />
          
          {/* Center glow */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20 pointer-events-none"
            style={{ 
              background: 'radial-gradient(circle, hsl(161 85% 60% / 0.1), transparent 60%)'
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
