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
      {/* Main dashboard image */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695056603a61a746b7ebbe31_light.svg"
        alt="LaunchPulse Dashboard"
        className="w-full animate-fade-in"
        style={{ animationDelay: "0.3s" }}
        loading="lazy"
        width="864"
      />
      
      {/* Floating TAM indicator - left side */}
      <div className="absolute -left-4 md:-left-16 bottom-10 md:bottom-20 animate-float-gentle" style={{ animationDelay: "0.5s" }}>
        <img 
          src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695060479ce89b8d2ce475be_TAM-01.svg"
          alt="TAM $5.9B Indicator"
          className="w-28 md:w-60"
          loading="lazy"
          width="245"
          height="239"
        />
      </div>
      
      {/* Floating ICP donut chart - right side */}
      <div className="absolute -right-4 md:-right-16 top-10 md:top-20 animate-float-gentle-delayed" style={{ animationDelay: "0.6s" }}>
        <img 
          src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69505f8e81701ec89798c0a8_icp-01.svg"
          alt="ICP Coverage Chart"
          className="w-24 md:w-60"
          loading="lazy"
          width="245"
          height="239"
        />
      </div>
    </div>
  );
}
