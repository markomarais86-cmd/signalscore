import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { Link } from "react-router-dom";

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
    <section className="container mx-auto px-6 pt-16 sm:pt-20 md:pt-24 pb-16 sm:pb-20 text-center relative">
      <h1
        className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold font-heading mb-6 leading-tight animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        {headline}
      </h1>

      <p
        className="text-base sm:text-lg md:text-xl text-white/60 max-w-3xl mx-auto mb-10 animate-fade-in"
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
