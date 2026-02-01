import { cn } from "@/lib/utils";

interface HeroDashboardMockupProps {
  className?: string;
}

export function HeroDashboardMockup({ className }: HeroDashboardMockupProps) {
  return (
    <div
      className={cn(
        "relative max-w-5xl mx-auto",
        className
      )}
    >
      {/* Glow effect behind the dashboard */}
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-30"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.4), transparent 70%)",
        }}
      />

      {/* Main dashboard image */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695056603a61a746b7ebbe31_light.svg"
        alt="LaunchPulse Dashboard"
        className="w-full animate-fade-in"
        style={{ animationDelay: "0.3s" }}
      />
      
      {/* Floating TAM indicator - left side */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695060479ce89b8d2ce475be_TAM-01.svg"
        alt="TAM $5.9B Indicator"
        className="absolute -left-4 md:-left-10 bottom-10 md:bottom-20 w-28 md:w-40 animate-fade-in floating-card-left"
        style={{ animationDelay: "0.5s" }}
      />
      
      {/* Floating ICP donut chart - right side */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69505f8e81701ec89798c0a8_icp-01.svg"
        alt="ICP Coverage Chart"
        className="absolute -right-4 md:-right-10 top-10 md:top-20 w-24 md:w-36 animate-fade-in floating-card"
        style={{ animationDelay: "0.6s" }}
      />
    </div>
  );
}
