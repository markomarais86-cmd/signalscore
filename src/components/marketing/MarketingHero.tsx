import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Diagonal arrow SVG matching original launchpulse.org
function DiagonalArrow({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      viewBox="0 0 18 18" 
      fill="none"
      className={className}
    >
      <path 
        d="M4.38237 12.4016L10.5268 6.25717L5.7538 6.25717L5.7538 4.7574L13.0872 4.7574L13.0872 12.0908L11.5874 12.0908V7.31783L5.44303 13.4622L4.38237 12.4016Z" 
        fill="currentColor"
      />
    </svg>
  );
}

interface MarketingHeroProps {
  headline: ReactNode;
  subheadline: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  children?: ReactNode;
}

export function MarketingHero({
  headline,
  subheadline,
  primaryCta,
  children,
}: MarketingHeroProps) {
  return (
    <section className="container mx-auto px-6 pt-24 pb-20 text-center relative">
      <h1
        className="text-4xl sm:text-5xl md:text-7xl font-bold font-heading mb-6 animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        {headline}
      </h1>

      <p
        className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto mb-10 animate-fade-in"
        style={{ animationDelay: "0.3s" }}
      >
        {subheadline}
      </p>

      {primaryCta && (
        <div
          className="flex items-center justify-center animate-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          <Link to={primaryCta.href}>
            <Button size="xl" variant="default" className="text-lg gap-2">
              {primaryCta.label}
              <DiagonalArrow />
            </Button>
          </Link>
        </div>
      )}

      {children}
    </section>
  );
}
